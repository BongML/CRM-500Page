"use client";

import { useEffect, useRef, useState } from "react";
import { btnGhost, btnPrimary, cardHint, cardTitle, label, select } from "@/lib/ui";
import TemplateLinks from "./TemplateLinks";
import { fetchLimits, uploadInParts, DEFAULT_LIMITS, type UploadLimits } from "@/lib/uploader";
import type { Group, Niche, Sub } from "@/lib/types";

/** Kết quả đọc 1 file do /api/import trả về. */
type FileResult = {
  file: string;
  kind: "metrics" | "posts" | null;
  sheet: string | null;
  from: string | null;
  to: string | null;
  rows: number;
  error: string | null;
};

type Counts = {
  scanned: number;
  unique: number;
  duplicates: number;
  created: number;
  updated: number;
};

type Occurrence = { file: string; reportedAt: string | null };

/** Giá trị "Nhóm đích" đặc biệt: dồn hết vào một nhóm chờ, không chia 25 page. */
const NO_SPLIT = "none";

/**
 * Gói file thành các lô sao cho mỗi lô không vượt trần dung lượng một lần gọi.
 * File vượt trần một mình vẫn nằm riêng một lô — nơi gọi phải chặn trước đó.
 */
function batchFiles(files: File[], maxTotal: number): File[][] {
  const lots: File[][] = [];
  let cur: File[] = [];
  let size = 0;

  for (const f of files) {
    if (cur.length && size + f.size > maxTotal) {
      lots.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(f);
    size += f.size;
  }
  if (cur.length) lots.push(cur);
  return lots;
}

const addCounts = <T extends Record<string, number>>(a: T, b: T): T => {
  const out = { ...a };
  for (const key of Object.keys(a) as (keyof T)[]) {
    out[key] = ((a[key] ?? 0) + (b[key] ?? 0)) as T[keyof T];
  }
  return out;
};

/** Gộp kết quả của nhiều lô thành một bảng tổng để hiển thị như một lần nhập. */
function mergeResults(a: ImportResult, b: ImportResult): ImportResult {
  return {
    dryRun: a.dryRun,
    files: [...a.files, ...b.files],
    pages: addCounts(a.pages, b.pages),
    posts: addCounts(a.posts, b.posts),
    trends: a.trends + b.trends,
    duplicateSample: [...a.duplicateSample, ...b.duplicateSample],
    duplicateTotal: a.duplicateTotal + b.duplicateTotal,
    nameClashes: [...a.nameClashes, ...b.nameClashes],
    failed: a.failed + b.failed,
  };
}

type ImportResult = {
  dryRun: boolean;
  files: FileResult[];
  pages: Counts & { matchedByName: number };
  posts: Counts & { linked: number; relinked: number };
  trends: number;
  duplicateSample: { label: string; kept: Occurrence; dropped: Occurrence[] }[];
  duplicateTotal: number;
  nameClashes: { name: string; ids: string[] }[];
  failed: number;
};

const KIND_LABEL: Record<"metrics" | "posts", string> = {
  metrics: "Chỉ số benchmark",
  posts: "Top content",
};

const panel = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 11,
} as const;

const box = { border: "1px solid var(--border)", borderRadius: 8 } as const;

const ellipsis = {
  flex: 1,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
} as const;

/** "2026-08-19T…" → "19/08/2026"; không có kỳ báo cáo thì "—". */
function day(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

/**
 * Form nhập báo cáo .xlsx từ Fanpage Karma (kéo-thả nhiều file).
 *
 * Không phải chọn loại báo cáo: server tự nhận diện "Metrics Overview"
 * (benchmark) hay "Top 25 Posts Overview" (top content), và tự lọc trùng trên
 * toàn lô trước khi ghi. Nút "Kiểm tra trùng" chạy đúng quy trình đó nhưng không
 * ghi gì xuống DB, để soi trước xem lô file sạch tới đâu.
 */
export default function ImportPanel({
  niches,
  groups,
  subs,
  onImported,
}: {
  niches: Niche[];
  groups: Group[];
  subs: Sub[];
  onImported: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [nicheId, setNicheId] = useState("");
  /** Trần dung lượng + cỡ mảnh do server công bố. */
  const [limit, setLimit] = useState<UploadLimits>(DEFAULT_LIMITS);
  /** Tiến độ khi phải chia nhiều lô: "đang gửi lô 2/3". */
  const [batch, setBatch] = useState<{ at: number; total: number } | null>(null);
  /** Tiến độ tải từng file lên theo mảnh: "đang tải 2/5". */
  const [sending, setSending] = useState<{ at: number; of: number } | null>(null);
  const [groupId, setGroupId] = useState("");
  const [subId, setSubId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<"" | "check" | "import">("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const groupSubs = subs.filter((s) => s.groupId === groupId);
  /**
   * Chọn một nhóm cụ thể mới cần chỉ định sub-group; "không chia nhóm" thì không.
   * Nhóm chưa có sub-group nào cũng không hỏi — server tự mở một sub cho lô này,
   * nếu không thì nút nhập kẹt mờ mà người dùng không có gì để chọn.
   */
  const needSub = !!groupId && groupId !== NO_SPLIT && groupSubs.length > 0;
  const blocked = !!busy || files.length === 0 || (needSub && !subId);

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const picked = Array.from(list).filter((f) => /\.xlsx$/i.test(f.name));
    if (picked.length < list.length) setError("Chỉ nhận file .xlsx — các file khác đã bỏ qua.");
    else setError(null);

    setFiles((prev) => {
      const merged = [...prev];
      for (const f of picked) {
        if (!merged.some((m) => m.name === f.name && m.size === f.size)) merged.push(f);
      }
      return merged;
    });
  }

  useEffect(() => {
    let alive = true;
    fetchLimits().then((l) => {
      if (alive) setLimit(l);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function submit(dryRun: boolean) {
    if (blocked) return;
    setBusy(dryRun ? "check" : "import");
    setError(null);

    try {
      const tooBig = files.filter((f) => f.size > limit.maxFileBytes);
      if (tooBig.length) {
        throw new Error(
          `Vượt trần ${limit.limitMb}MB mỗi file: ${tooBig
            .map((f) => decodeURIComponent(f.name))
            .join(", ")}`,
        );
      }

      // Gói file thành các lô vừa trần dung lượng rồi gửi lần lượt. Trong cùng
      // một lô, server vẫn lọc trùng chéo giữa các file như trước.
      const lots = batchFiles(files, limit.maxTotalBytes);
      let merged: ImportResult | null = null;

      for (let i = 0; i < lots.length; i++) {
        setBatch(lots.length > 1 ? { at: i + 1, total: lots.length } : null);

        // Không gửi thẳng file: nền tảng chặn body request quá ~4.5MB, nên mỗi
        // file được cắt mảnh đẩy lên trước, ở đây chỉ đưa mã để server ghép lại.
        const body = new FormData();
        for (const f of lots[i]) {
          const id = await uploadInParts(f, limit.chunkBytes, (at, of) => setSending({ at, of }));
          body.append("uploads", id);
        }
        setSending(null);

        if (nicheId) body.append("nicheId", nicheId);
        if (groupId === NO_SPLIT) {
          body.append("groupId", NO_SPLIT);
        } else if (groupId) {
          body.append("groupId", groupId);
          if (subId) body.append("subId", subId);
        }
        if (dryRun) body.append("dryRun", "1");

        const res = await fetch("/api/import", { method: "POST", body });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error ?? "Nhập dữ liệu thất bại.");

        merged = merged ? mergeResults(merged, json as ImportResult) : (json as ImportResult);
      }

      if (!merged) throw new Error("Chưa chọn file nào.");
      setResult(merged);
      // Chỉ soát trùng thì giữ nguyên danh sách file để bấm nhập ngay sau đó.
      if (!dryRun) {
        setFiles([]);
        onImported();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nhập dữ liệu thất bại.");
    } finally {
      setBusy("");
      setBatch(null);
      setSending(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ ...panel, padding: "16px 18px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={cardTitle}>Nhập báo cáo Karmar (.xlsx)</div>
          <div style={cardHint}>Benchmark & Top content — tự nhận diện, tự lọc trùng</div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => picker.current?.click()}
          style={{
            border: `1.5px dashed ${dragging ? "var(--accent)" : "var(--border-strong)"}`,
            borderRadius: 11,
            background: dragging ? "var(--accent-soft)" : "transparent",
            padding: "30px 18px",
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 22, lineHeight: 1, color: "var(--accent)" }}>↑</div>
          <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 8 }}>
            Kéo thả file .xlsx vào đây
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 5 }}>
            hoặc bấm để chọn từ máy · nhiều file cùng lúc · page trùng giữa các file được gộp làm một
          </div>
          <input
            ref={picker}
            type="file"
            accept=".xlsx"
            multiple
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
        </div>

        <TemplateLinks
          kinds={["benchmark", "content"]}
          hint="Chưa rõ báo cáo cần những cột nào?"
        />

        {files.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={label}>Đã chọn ({files.length})</label>
            <div style={box}>
              {files.map((f) => (
                <div
                  key={f.name + f.size}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--border)",
                    fontSize: 12.5,
                  }}
                >
                  <span style={ellipsis}>{decodeURIComponent(f.name)}</span>
                  <span style={{ fontSize: 11, color: "var(--faint)" }}>
                    {Math.max(1, Math.round(f.size / 1024))} KB
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setFiles((prev) => prev.filter((x) => x !== f));
                    }}
                    aria-label={`Bỏ ${f.name}`}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--muted)",
                      cursor: "pointer",
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200, flex: 1 }}>
            <label style={label}>Ngách cho page mới</label>
            <select
              value={nicheId}
              onChange={(e) => setNicheId(e.target.value)}
              style={{ ...select, height: 38 }}
            >
              <option value="">Chưa phân loại (tự tạo)</option>
              {niches.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200, flex: 1 }}>
            <label style={label}>Nhóm đích</label>
            <select
              value={groupId}
              onChange={(e) => {
                setGroupId(e.target.value);
                setSubId("");
              }}
              style={{ ...select, height: 38 }}
            >
              <option value="">Tự chia nhóm 25 page</option>
              <option value={NO_SPLIT}>Không chia nhóm (dồn vào “Chưa phân nhóm”)</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          {needSub && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200, flex: 1 }}>
              <label style={label}>Sub-group đích</label>
              <select
                value={subId}
                onChange={(e) => setSubId(e.target.value)}
                style={{ ...select, height: 38 }}
              >
                <option value="">— Chọn sub-group —</option>
                {groupSubs.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {error && (
          <div
            style={{
              padding: "9px 12px",
              borderRadius: 8,
              background: "var(--danger-soft)",
              color: "var(--danger)",
              fontSize: 12.5,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={() => submit(false)}
            disabled={blocked}
            style={{ ...btnPrimary, opacity: blocked ? 0.55 : 1 }}
          >
            {busy === "import"
              ? sending && sending.of > 1
                ? `Đang tải lên… ${sending.at}/${sending.of}`
                : batch
                  ? `Đang nhập… lô ${batch.at}/${batch.total}`
                  : "Đang nhập…"
              : files.length
                ? `Nhập ${files.length} file`
                : "Nhập dữ liệu"}
          </button>
          <button
            onClick={() => submit(true)}
            disabled={blocked}
            style={{ ...btnGhost, opacity: blocked ? 0.55 : 1 }}
          >
            {busy === "check"
              ? sending && sending.of > 1
                ? `Đang tải lên… ${sending.at}/${sending.of}`
                : batch
                  ? `Đang soát… lô ${batch.at}/${batch.total}`
                  : "Đang soát…"
              : "Kiểm tra trùng"}
          </button>
          {files.length > 0 && !busy && (
            <button onClick={() => setFiles([])} style={btnGhost}>
              Xóa danh sách
            </button>
          )}
        </div>

        <div style={{ fontSize: 11.5, color: "var(--faint)", lineHeight: 1.7 }}>
          Page nhận nhau theo Profile-ID nên hai loại báo cáo của cùng một list page ghép về đúng
          một page, không nhân đôi. Page đã có sẽ được cập nhật số liệu và giữ nguyên ngách, nhóm
          đang gán. Cùng một page nằm trong nhiều file thì lấy số của báo cáo có kỳ mới nhất.
        </div>
      </div>

      {result && <ResultPanel result={result} />}
    </div>
  );
}

/** Bảng kết quả của lần nhập / lần soát trùng gần nhất. */
function ResultPanel({ result }: { result: ImportResult }) {
  const { pages, posts } = result;

  const tiles: [string, string | number, string][] = [
    [
      "Page vào hệ thống",
      pages.unique,
      `${pages.created} mới · ${pages.updated} cập nhật`,
    ],
    [
      "Page trùng đã lọc",
      pages.duplicates,
      pages.duplicates ? `từ ${pages.scanned} dòng đọc được` : "không có dòng trùng",
    ],
    [
      "Bài viết",
      posts.unique,
      `${posts.created} mới · ${posts.duplicates} trùng đã lọc`,
    ],
    [
      "Bài khớp được page",
      posts.linked + posts.relinked,
      posts.relinked
        ? `${posts.relinked} bài nhập trước nay mới nối được`
        : posts.unique
          ? `/ ${posts.unique} bài · ${result.trends} hashtag`
          : "chưa nhập top content",
    ],
  ];

  return (
    <div style={{ ...panel, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={cardTitle}>
          {result.dryRun ? "Kết quả soát trùng (chưa ghi)" : "Kết quả lần nhập gần nhất"}
        </div>
        {result.dryRun && (
          <div style={{ ...cardHint, color: "var(--warn)" }}>
            Chưa có gì được ghi xuống hệ thống
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}>
        {tiles.map(([k, v, sub]) => (
          <div key={k} style={{ ...box, borderRadius: 9, padding: "10px 12px" }}>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{k}</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginTop: 2 }}>{v}</div>
            <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 3 }}>{sub}</div>
          </div>
        ))}
      </div>

      {pages.matchedByName > 0 && (
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          {pages.matchedByName} page được nhận ra qua tên vì bản ghi cũ chưa có Profile-ID — số liệu
          ghi đè lên page cũ thay vì tạo page mới.
        </div>
      )}

      {/* Từng file: loại báo cáo + kỳ số liệu */}
      <div style={box}>
        {result.files.map((f) => (
          <div key={f.file} style={{ padding: "9px 12px", borderBottom: "1px solid var(--border)", fontSize: 12.5 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={ellipsis}>{f.file}</span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: f.error ? "var(--danger)" : "var(--good)",
                }}
              >
                {f.error ? "Lỗi" : KIND_LABEL[f.kind ?? "metrics"]}
              </span>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 2 }}>
              {f.error
                ? f.error
                : `${f.rows} dòng · kỳ ${day(f.from)} – ${day(f.to)} · sheet "${f.sheet}"`}
            </div>
          </div>
        ))}
      </div>

      {result.duplicateSample.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={label}>
            Dòng trùng đã lọc ({result.duplicateTotal})
          </label>
          <div style={{ ...box, maxHeight: 260, overflow: "auto" }} className="crm-scroll">
            {result.duplicateSample.map((d, i) => (
              <div
                key={d.label + i}
                style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", fontSize: 12 }}
              >
                <div style={{ fontWeight: 500, ...ellipsis }}>{d.label}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2, lineHeight: 1.55 }}>
                  Giữ bản của <b>{d.kept.file}</b> (kỳ {day(d.kept.reportedAt)}) · bỏ{" "}
                  {d.dropped.map((x) => `${x.file} (${day(x.reportedAt)})`).join(", ")}
                </div>
              </div>
            ))}
          </div>
          {result.duplicateTotal > result.duplicateSample.length && (
            <div style={{ fontSize: 11.5, color: "var(--faint)" }}>
              Hiển thị {result.duplicateSample.length} dòng đầu.
            </div>
          )}
        </div>
      )}

      {result.nameClashes.length > 0 && (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "var(--danger-soft)",
            color: "var(--danger)",
            fontSize: 12,
            lineHeight: 1.6,
          }}
        >
          <b>{result.nameClashes.length} tên page trùng nhau nhưng khác Profile-ID</b> — đây có thể
          là các page khác nhau vô tình trùng tên nên hệ thống giữ riêng, không gộp:{" "}
          {result.nameClashes
            .slice(0, 6)
            .map((c) => c.name)
            .join(", ")}
          {result.nameClashes.length > 6 ? "…" : ""}
        </div>
      )}
    </div>
  );
}
