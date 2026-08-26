"use client";

import { useEffect, useRef, useState } from "react";
import { btnGhost, btnPrimary, cardHint, cardTitle, label, select } from "@/lib/ui";
import type { Niche } from "@/lib/types";
import TemplateLinks from "./TemplateLinks";
import { fetchLimits, uploadInParts, DEFAULT_LIMITS, type UploadLimits } from "@/lib/uploader";

/** Cách chia nhóm gửi lên /api/groups/arrange. */
type Mode = "auto" | "column" | "size";

/** Kết quả /api/groups/arrange trả về. */
type ArrangeResult = {
  dryRun: boolean;
  /** Cách chia server thực sự đã dùng (mode "auto" được quy về một trong hai). */
  mode: "column" | "size";
  file: string;
  sheet: string | null;
  size: number;
  rows: number;
  /** Số dòng của file có nhãn ở cột Nhóm. */
  labelled: number;
  /** Số ô Profile-ID bị Excel làm tròn nên phải bỏ, khớp bằng tên thay thế. */
  brokenRefs: number;
  matched: number;
  duplicates: number;
  /** Dòng trỏ về page đã xếp ở dòng trên — kèm tên page nó đụng phải. */
  duplicateSample: { line: number; label: string }[];
  moved: number;
  /** Số page mới được tạo từ dòng chưa có trong hệ thống. */
  created: number;
  createdSample: string[];
  /** Dòng khớp page nhưng bỏ trống cột Nhóm — page giữ nguyên chỗ cũ. */
  unlabelled: number;
  leftover: number;
  leftoverMode: "append" | "keep";
  groups: { name: string; count: number; created: boolean; fresh: number; sample: string[] }[];
  groupTotal: number;
  newGroups: number;
  renumbered: number;
  unmatched: { line: number; label: string }[];
  unmatchedTotal: number;
  ambiguous: string[];
  emptied: string[];
  pruned: number;
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

const ACCEPT = ".xlsx,.csv,.txt";
const OK_FILE = /\.(xlsx|csv|txt)$/i;

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "auto", label: "Tự động", hint: 'Có cột "Nhóm" thì phân loại theo cột, không thì chia đều' },
  { id: "column", label: 'Theo cột "Nhóm"', hint: "Mỗi nhãn trong cột Nhóm là một nhóm page" },
  { id: "size", label: "Chia đều", hint: "Cứ N page liên tiếp trong file thành một nhóm" },
];

/** Ô tick nhỏ dùng chung cho các tùy chọn của form. */
function Check({
  on,
  onToggle,
  title,
  hint,
}: {
  on: boolean;
  onToggle: (v: boolean) => void;
  title: string;
  hint: string;
}) {
  return (
    <label
      style={{
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        cursor: "pointer",
        fontSize: 12.5,
        lineHeight: 1.5,
      }}
    >
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onToggle(e.target.checked)}
        style={{ marginTop: 2, accentColor: "var(--accent)", cursor: "pointer" }}
      />
      <span>
        <span style={{ fontWeight: 500 }}>{title}</span>
        <span style={{ display: "block", fontSize: 11.5, color: "var(--faint)" }}>{hint}</span>
      </span>
    </label>
  );
}

/**
 * Xếp page vào nhóm theo một file danh sách. Hai cách chia:
 *
 *  - **theo cột "Nhóm"** — file phân loại (STT · Tên page · Profile-ID · Nhóm):
 *    page nào ghi nhãn nào thì về đúng nhóm mang tên ấy;
 *  - **chia đều** — file chỉ có thứ tự: cứ N page liên tiếp thành một nhóm.
 *
 * File không mang số liệu — page phải đã có trong hệ thống (nhập từ báo cáo
 * Karmar), ở đây chỉ khớp lại theo Profile-ID / tên / link rồi xếp chỗ. Dòng
 * chưa có page nào có thể tạo mới với số liệu 0 (tick "Tạo page chưa có"), giữ
 * chỗ trong nhóm cho tới khi báo cáo Karmar về. Luôn có nút "Xem trước" chạy
 * đúng quy trình nhưng không ghi gì.
 */
export default function ArrangePanel({
  niches,
  onArranged,
}: {
  niches: Niche[];
  onArranged: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<Mode>("auto");
  const [size, setSize] = useState(25);
  const [create, setCreate] = useState(false);
  const [nicheId, setNicheId] = useState("");
  const [rename, setRename] = useState(true);
  const [append, setAppend] = useState(false);
  const [prune, setPrune] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState<"" | "check" | "run">("");
  /** Trần dung lượng + cỡ mảnh do server công bố. */
  const [limit, setLimit] = useState<UploadLimits>(DEFAULT_LIMITS);
  /** Tiến độ tải file lên theo mảnh: "đang tải 2/5". */
  const [sending, setSending] = useState<{ at: number; of: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ArrangeResult | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const blocked = !!busy || !file;

  useEffect(() => {
    let alive = true;
    fetchLimits().then((l) => {
      if (alive) setLimit(l);
    });
    return () => {
      alive = false;
    };
  }, []);
  /** Các tùy chọn của cách chia đều: mode "column" không dùng tới. */
  const bySize = mode !== "column";

  function take(list: FileList | null) {
    const picked = list?.[0];
    if (!picked) return;
    if (!OK_FILE.test(picked.name)) {
      setError("Chỉ nhận file .xlsx, .csv hoặc .txt.");
      return;
    }
    setError(null);
    setFile(picked);
  }

  async function submit(dryRun: boolean) {
    if (!file || busy) return;
    setBusy(dryRun ? "check" : "run");
    setError(null);

    try {
      if (file.size > limit.maxFileBytes) {
        throw new Error(`File lớn hơn ${limit.limitMb}MB.`);
      }

      // Không gửi thẳng file: nền tảng chặn body request quá ~4.5MB, nên file
      // được cắt mảnh đẩy lên trước, ở đây chỉ đưa mã để server ghép lại.
      const upload = await uploadInParts(file, limit.chunkBytes, (at, of) => setSending({ at, of }));
      setSending(null);

      const body = new FormData();
      body.append("upload", upload);
      body.append("mode", mode);
      body.append("size", String(size));
      body.append("rename", rename ? "1" : "0");
      body.append("leftover", append ? "append" : "keep");
      if (create) {
        body.append("create", "1");
        if (nicheId) body.append("nicheId", nicheId);
      }
      if (prune) body.append("prune", "1");
      if (dryRun) body.append("dryRun", "1");

      const res = await fetch("/api/groups/arrange", { method: "POST", body });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Gom nhóm thất bại.");

      setResult(json as ArrangeResult);
      if (!dryRun) onArranged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gom nhóm thất bại.");
    } finally {
      setBusy("");
      setSending(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        style={{
          ...panel,
          padding: "16px 18px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <div style={cardTitle}>Xếp nhóm theo file danh sách</div>
          <div style={cardHint}>
            {mode === "column"
              ? 'Mỗi nhãn ở cột "Nhóm" = 1 nhóm page'
              : mode === "size"
                ? `Mỗi ${size} page liên tiếp trong file = 1 nhóm`
                : 'Có cột "Nhóm" thì phân loại theo cột'}
          </div>
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
            take(e.dataTransfer.files);
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
            Kéo thả file phân loại page vào đây
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 5 }}>
            .xlsx / .csv / .txt · cột Tên page (hoặc Profile-ID) · thêm cột <b>Nhóm</b> để xếp thẳng
            vào nhóm mang tên đó
          </div>
          <input
            ref={picker}
            type="file"
            accept={ACCEPT}
            onChange={(e) => {
              take(e.target.files);
              e.target.value = "";
            }}
            style={{ display: "none" }}
          />
        </div>

        <TemplateLinks kinds={["classify"]} hint="Chưa rõ file cần những cột nào?" />

        {file && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={label}>File đã chọn</label>
            <div
              style={{
                ...box,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                fontSize: 12.5,
              }}
            >
              <span style={ellipsis}>{decodeURIComponent(file.name)}</span>
              <span style={{ fontSize: 11, color: "var(--faint)" }}>
                {Math.max(1, Math.round(file.size / 1024))} KB
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFile(null);
                }}
                aria-label="Bỏ file đã chọn"
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
          </div>
        )}

        {/* Cách chia nhóm */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={label}>Cách chia nhóm</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {MODES.map((m) => {
              const active = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  title={m.hint}
                  style={{
                    padding: "7px 13px",
                    border: `1px solid ${active ? "var(--accent)" : "var(--border-strong)"}`,
                    borderRadius: 8,
                    cursor: "pointer",
                    fontSize: 12.5,
                    fontWeight: active ? 600 : 500,
                    background: active ? "var(--accent)" : "transparent",
                    color: active ? "#fff" : "var(--text)",
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--faint)" }}>
            {MODES.find((m) => m.id === mode)?.hint}
          </div>
        </div>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
          {bySize && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 170 }}>
              <label style={label} htmlFor="arrange-size">
                Số page mỗi nhóm
              </label>
              <input
                id="arrange-size"
                type="number"
                min={1}
                max={500}
                value={size}
                onChange={(e) =>
                  setSize(Math.max(1, Math.min(500, Math.round(+e.target.value || 1))))
                }
                style={{
                  height: 38,
                  padding: "0 12px",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  background: "var(--surface)",
                  color: "var(--text)",
                  fontSize: 14,
                }}
              />
              <span style={{ fontSize: 11, color: "var(--faint)" }}>
                {mode === "auto" ? 'chỉ dùng khi file không có cột "Nhóm"' : " "}
              </span>
            </div>
          )}

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              flex: 1,
              minWidth: 260,
              paddingTop: bySize ? 22 : 0,
            }}
          >
            <Check
              on={create}
              onToggle={setCreate}
              title="Tạo page chưa có trong hệ thống"
              hint="Dòng chưa khớp page nào (thường là Profile-ID = 0) thành page mới, số liệu 0 cho tới khi nhập báo cáo Karmar"
            />
            {bySize && (
              <>
                <Check
                  on={rename}
                  onToggle={setRename}
                  title="Đặt lại tên nhóm theo thứ tự"
                  hint="Nhóm 01, Nhóm 02… đúng theo thứ tự trong file"
                />
                <Check
                  on={append}
                  onToggle={setAppend}
                  title="Xếp cả page không có trong file"
                  hint="Nối vào cuối danh sách để nhóm nào cũng đủ số; bỏ tick thì chúng giữ nguyên nhóm cũ"
                />
              </>
            )}
            <Check
              on={prune}
              onToggle={setPrune}
              title="Xóa nhóm rỗng sau khi gom"
              hint="Dọn các nhóm không còn page nào"
            />
          </div>
        </div>

        {create && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 320 }}>
            <label style={label} htmlFor="arrange-niche">
              Ngách cho page mới tạo
            </label>
            <select
              id="arrange-niche"
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
        )}

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
            {busy === "run"
              ? sending && sending.of > 1
                ? `Đang tải lên… ${sending.at}/${sending.of}`
                : "Đang xếp…"
              : "Xếp nhóm"}
          </button>
          <button
            onClick={() => submit(true)}
            disabled={blocked}
            style={{ ...btnGhost, opacity: blocked ? 0.55 : 1 }}
          >
            {busy === "check"
              ? sending && sending.of > 1
                ? `Đang tải lên… ${sending.at}/${sending.of}`
                : "Đang đọc…"
              : "Xem trước"}
          </button>
        </div>

        <div style={{ fontSize: 11.5, color: "var(--faint)", lineHeight: 1.7 }}>
          Page trong file được nhận ra theo Profile-ID, rồi đến tên đã chuẩn hóa, cuối cùng là link
          (ô Profile-ID ghi <b>0</b> tính như bỏ trống). File chỉ quyết định{" "}
          <b>chỗ ngồi của page</b> — số liệu, ngách và top content giữ nguyên. Ở cách chia theo cột
          Nhóm, nhóm trùng tên với nhóm đang có được dùng lại; nhóm và page không nằm trong file
          không bị đụng tới.
        </div>
      </div>

      {result && <ResultPanel result={result} />}
    </div>
  );
}

/** Bảng kết quả của lần xếp / lần xem trước gần nhất. */
function ResultPanel({ result }: { result: ArrangeResult }) {
  const byColumn = result.mode === "column";

  const tiles: [string, string | number, string][] = [
    [
      byColumn ? "Nhóm trong file" : "Nhóm sau khi gom",
      result.groupTotal,
      byColumn
        ? `${result.newGroups} nhóm mới · ${result.groupTotal - result.newGroups} dùng lại`
        : `${result.size} page/nhóm · ${result.newGroups} nhóm mới`,
    ],
    ["Page đã xếp", result.matched, `khớp ${result.matched}/${result.rows} dòng của file`],
    [
      "Page đổi nhóm",
      result.moved,
      result.dryRun ? "sẽ chuyển chỗ khi bấm Xếp nhóm" : "đã chuyển sang nhóm mới",
    ],
    byColumn
      ? [
          "Page mới",
          result.created,
          result.created
            ? result.dryRun
              ? "sẽ tạo với số liệu 0"
              : "đã tạo, chờ báo cáo Karmar"
            : "mọi dòng đều đã có page",
        ]
      : [
          "Page ngoài file",
          result.leftover,
          result.leftover
            ? result.leftoverMode === "append"
              ? "đã nối vào cuối danh sách"
              : "giữ nguyên nhóm cũ"
            : "mọi page đều có trong file",
        ],
  ];

  return (
    <div
      style={{ ...panel, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={cardTitle}>
          {result.dryRun ? "Xem trước (chưa ghi)" : "Kết quả xếp nhóm"}
          <span style={{ fontSize: 11.5, fontWeight: 500, color: "var(--faint)", marginLeft: 8 }}>
            {byColumn ? `theo cột Nhóm · ${result.labelled} dòng có nhãn` : `chia đều ${result.size} page/nhóm`}
          </span>
        </div>
        <div style={{ ...cardHint, color: result.dryRun ? "var(--warn)" : "var(--faint)" }}>
          {result.dryRun
            ? "Chưa có gì được ghi xuống hệ thống"
            : `${result.file}${result.sheet ? ` · sheet "${result.sheet}"` : ""}`}
        </div>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 10 }}
      >
        {tiles.map(([k, v, sub]) => (
          <div key={k} style={{ ...box, borderRadius: 9, padding: "10px 12px" }}>
            <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{k}</div>
            <div style={{ fontSize: 19, fontWeight: 700, marginTop: 2 }}>{v}</div>
            <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 3 }}>{sub}</div>
          </div>
        ))}
      </div>

      {result.brokenRefs > 0 && (
        <div style={{ fontSize: 12, color: "var(--warn)", lineHeight: 1.6 }}>
          {result.brokenRefs} ô Profile-ID bị Excel làm tròn (dạng <code>1.21954E+20</code>) nên
          không dùng được — các dòng đó đã khớp bằng tên page. Xuất lại file với cột Profile-ID để
          dạng <b>Text</b> thì khớp chắc chắn hơn.
        </div>
      )}

      {result.duplicates > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ ...label, color: "var(--warn)" }}>
            Dòng trùng ({result.duplicates}) — trỏ về page đã xếp ở dòng trên, chỉ tính lần đầu
          </label>
          <div style={{ ...box, maxHeight: 180, overflow: "auto" }} className="crm-scroll">
            {result.duplicateSample.map((d) => (
              <div
                key={d.line}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "7px 12px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 12,
                }}
              >
                <span style={{ color: "var(--faint)", minWidth: 56 }}>dòng {d.line}</span>
                <span style={ellipsis}>{d.label}</span>
              </div>
            ))}
          </div>
          {result.duplicates > result.duplicateSample.length && (
            <div style={{ fontSize: 11.5, color: "var(--faint)" }}>
              Hiển thị {result.duplicateSample.length} dòng đầu.
            </div>
          )}
        </div>
      )}

      {result.unlabelled > 0 && (
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          {result.unlabelled} dòng khớp page nhưng bỏ trống cột Nhóm — các page đó giữ nguyên nhóm
          cũ.
        </div>
      )}

      {/* Từng nhóm sẽ hình thành, kèm vài page đầu để đối chiếu với file */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <label style={label}>
          {byColumn ? "Nhóm theo cột Nhóm trong file" : "Nhóm theo thứ tự trong file"}
        </label>
        <div style={{ ...box, maxHeight: 300, overflow: "auto" }} className="crm-scroll">
          {result.groups.map((g, i) => (
            <div
              key={g.name + i}
              style={{
                display: "flex",
                gap: 10,
                alignItems: "baseline",
                padding: "8px 12px",
                borderBottom: "1px solid var(--border)",
                fontSize: 12.5,
              }}
            >
              <span style={{ fontWeight: 600, minWidth: 110 }}>{g.name}</span>
              <span style={{ color: "var(--muted)", minWidth: 62 }}>{g.count} page</span>
              <span style={{ ...ellipsis, color: "var(--faint)", fontSize: 11.5 }}>
                {g.sample.join(" · ")}
                {g.count > g.sample.length ? " …" : ""}
              </span>
              {g.fresh > 0 && (
                <span style={{ fontSize: 11, color: "var(--accent)", whiteSpace: "nowrap" }}>
                  +{g.fresh} page mới
                </span>
              )}
              {g.created && (
                <span style={{ fontSize: 11, color: "var(--good)", fontWeight: 600 }}>mới</span>
              )}
            </div>
          ))}
        </div>
        {result.groupTotal > result.groups.length && (
          <div style={{ fontSize: 11.5, color: "var(--faint)" }}>
            Hiển thị {result.groups.length}/{result.groupTotal} nhóm đầu.
          </div>
        )}
      </div>

      {result.created > 0 && (
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          {result.dryRun ? "Sẽ tạo " : "Đã tạo "}
          {result.created} page mới (số liệu 0 cho tới khi nhập báo cáo Karmar):{" "}
          {result.createdSample.slice(0, 8).join(", ")}
          {result.createdSample.length > 8 ? "…" : ""}
        </div>
      )}

      {result.unmatchedTotal > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ ...label, color: "var(--warn)" }}>
            Dòng không khớp page nào ({result.unmatchedTotal}) — bị bỏ qua
          </label>
          <div style={{ ...box, maxHeight: 220, overflow: "auto" }} className="crm-scroll">
            {result.unmatched.map((u) => (
              <div
                key={u.line}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "7px 12px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 12,
                }}
              >
                <span style={{ color: "var(--faint)", minWidth: 56 }}>dòng {u.line}</span>
                <span style={ellipsis}>{u.label}</span>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11.5, color: "var(--faint)" }}>
            {result.unmatchedTotal > result.unmatched.length
              ? `Hiển thị ${result.unmatched.length} dòng đầu. `
              : ""}
            Tick “Tạo page chưa có trong hệ thống” để các dòng này thành page mới thay vì bị bỏ qua.
          </div>
        </div>
      )}

      {result.ambiguous.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          {result.ambiguous.length} tên page đang bị trùng giữa nhiều page trong hệ thống nên không
          dùng tên để khớp được — các dòng đó cần Profile-ID hoặc link.
        </div>
      )}

      {result.renumbered > 0 && (
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          {result.renumbered} nhóm không nằm trong file được đánh số tiếp ngay sau đó (Nhóm{" "}
          {String(result.groupTotal + 1).padStart(2, "0")} trở đi) để cả hệ thống là một dãy liền
          mạch.
        </div>
      )}

      {result.emptied.length > 0 && (
        <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
          {result.pruned
            ? `Đã xóa ${result.pruned} nhóm rỗng: `
            : `${result.emptied.length} nhóm không còn page nào: `}
          {result.emptied.slice(0, 8).join(", ")}
          {result.emptied.length > 8 ? "…" : ""}
        </div>
      )}
    </div>
  );
}
