"use client";

import { useMemo, useState } from "react";
import { btnGhost, btnMini, btnPrimary, cardHint, cardTitle, inputMini, select, tnum } from "@/lib/ui";
import { int, tint } from "@/lib/format";
import { followerRank, hotLevel } from "@/lib/rank";
import type { Group, Niche, Owner, Page, Sub } from "@/lib/types";
import { Avatar, HotMeter, RankBadge } from "./Atoms";
import ClassifyLegend from "./ClassifyLegend";
import MoveConfirm, { type MoveAsk } from "./MoveConfirm";

const COLS = "34px minmax(180px,2.2fr) 84px 46px 140px 140px 150px 92px 66px";

/**
 * Bảng gán page: tìm kiếm, lọc, tick nhiều dòng rồi gán ngách / chuyển nhóm
 * hàng loạt; hoặc đổi trực tiếp ngay trên từng dòng.
 */
export default function ManagePages({
  pages,
  niches,
  groups,
  subs,
  onAssignNiche,
  onMovePage,
  onBulk,
  onDeletePages,
  onDeletePage,
  owners,
}: {
  pages: Page[];
  niches: Niche[];
  groups: Group[];
  subs: Sub[];
  /** Chỉ khác rỗng khi tài khoản tổng đang xem gộp nhiều tài khoản. */
  owners: Owner[];
  onAssignNiche: (pageId: string, nicheId: string) => void;
  onMovePage: (pageId: string, groupId: string, subId: string) => void;
  onBulk: (ids: string[], change: { nicheId?: string; subId?: string }) => void;
  onDeletePages: (ids: string[]) => void;
  onDeletePage: (pageId: string) => void;
}) {
  /**
   * Xem gộp nhiều tài khoản thì ngách/nhóm phải lọc theo đúng chủ của từng page:
   * page của A không thể chuyển vào nhóm của B.
   */
  const multi = owners.length > 1;
  const ownerName = (id?: string) => owners.find((o) => o.id === id)?.name ?? "";
  const ownedBy = <T extends { userId?: string }>(list: T[], userId?: string) =>
    multi ? list.filter((x) => x.userId === userId) : list;
  const [search, setSearch] = useState("");
  const [nicheFilter, setNicheFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [bulkNiche, setBulkNiche] = useState("");
  const [bulkSub, setBulkSub] = useState("");
  const [hotFilter, setHotFilter] = useState("all");
  /** Xóa hàng loạt không hoàn tác được — bấm lần đầu chỉ chuyển nút sang trạng thái hỏi lại. */
  const [askDelete, setAskDelete] = useState(false);
  /** Chuyển nhóm/sub phải qua modal xác nhận, dropdown chỉ đề xuất chứ chưa ghi. */
  const [moveAsk, setMoveAsk] = useState<MoveAsk | null>(null);

  const groupName = (id: string) => groups.find((g) => g.id === id)?.name ?? "—";
  const subName = (id: string) => subs.find((s) => s.id === id)?.name ?? "—";

  /** Dựng yêu cầu chờ xác nhận; bỏ qua nếu chọn lại đúng chỗ page đang nằm. */
  function askMove(page: Page, kind: "group" | "sub", groupId: string, subId: string) {
    if (page.groupId === groupId && page.subId === subId) return;
    setMoveAsk({
      page,
      kind,
      groupId,
      subId,
      fromGroup: groupName(page.groupId),
      fromSub: subName(page.subId),
      toGroup: groupName(groupId),
      toSub: subName(subId),
    });
  }

  function confirmMove() {
    if (!moveAsk) return;
    onMovePage(moveAsk.page.id, moveAsk.groupId, moveAsk.subId);
    setMoveAsk(null);
  }

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return pages.filter(
      (p) =>
        (!term || p.name.toLowerCase().includes(term)) &&
        (nicheFilter === "all" || p.nicheId === nicheFilter) &&
        (groupFilter === "all" || p.groupId === groupFilter) &&
        (hotFilter === "all" || String(hotLevel(p.views)) === hotFilter),
    );
  }, [pages, search, nicheFilter, groupFilter, hotFilter]);

  const ids = useMemo(() => Object.keys(picked).filter((k) => picked[k]), [picked]);
  const allOn = rows.length > 0 && rows.every((p) => picked[p.id]);

  function applyBulk() {
    if (!ids.length) return;
    const change: { nicheId?: string; subId?: string } = {};
    if (bulkNiche) change.nicheId = bulkNiche;
    if (bulkSub) change.subId = bulkSub;
    if (!change.nicheId && !change.subId) return;

    onBulk(ids, change);
    setPicked({});
    setAskDelete(false);
    setBulkNiche("");
    setBulkSub("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <ClassifyLegend pages={pages} />

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 11,
          overflow: "hidden",
        }}
      >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          padding: "15px 18px 12px",
        }}
      >
        <div>
          <div style={cardTitle}>Gán page vào nhóm & ngách</div>
          <div style={{ ...cardHint, marginTop: 2 }}>
            {rows.length}/{pages.length} page · đổi trực tiếp trên dòng hoặc tick nhiều dòng để gán
            hàng loạt
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm page…"
            style={{ ...inputMini, height: 32, width: 190 }}
          />
          <select value={nicheFilter} onChange={(e) => setNicheFilter(e.target.value)} style={select}>
            <option value="all">Tất cả ngách</option>
            {niches.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
          <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} style={select}>
            <option value="all">Tất cả nhóm</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <select
            value={hotFilter}
            onChange={(e) => setHotFilter(e.target.value)}
            style={select}
            aria-label="Lọc theo độ hot"
          >
            <option value="all">Mọi độ hot</option>
            <option value="1">⚡ Rất yếu — dưới 5K views</option>
            <option value="2">⚡⚡ Yếu — từ 5K</option>
            <option value="3">⚡⚡⚡ Khá — từ 20K</option>
            <option value="4">⚡⚡⚡⚡ Hot — từ 50K</option>
            <option value="5">⚡⚡⚡⚡⚡ Rất hot — từ 100K</option>
          </select>
        </div>
      </div>

      {ids.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            padding: "10px 18px",
            background: "var(--accent-soft)",
            borderTop: "1px solid var(--border)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600 }}>{ids.length} page đã chọn</span>

          <select value={bulkNiche} onChange={(e) => setBulkNiche(e.target.value)} style={select}>
            <option value="">Gán ngách…</option>
            {niches.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
                {multi ? ` (${ownerName(n.userId)})` : ""}
              </option>
            ))}
          </select>

          <select value={bulkSub} onChange={(e) => setBulkSub(e.target.value)} style={select}>
            <option value="">Chuyển vào nhóm…</option>
            {groups
              .filter((g) => subs.some((x) => x.groupId === g.id))
              .map((g) => (
              <optgroup key={g.id} label={multi ? `${g.name} (${ownerName(g.userId)})` : g.name}>
                {subs
                  .filter((s) => s.groupId === g.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {g.name} › {s.name}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>

          <button
            onClick={applyBulk}
            disabled={!bulkNiche && !bulkSub}
            style={{ ...btnPrimary, height: 32, fontSize: 12.5, opacity: !bulkNiche && !bulkSub ? 0.55 : 1 }}
          >
            Áp dụng
          </button>
          <button
            onClick={() => {
              if (!askDelete) {
                setAskDelete(true);
                window.setTimeout(() => setAskDelete(false), 5000);
                return;
              }
              onDeletePages(ids);
              setPicked({});
              setAskDelete(false);
            }}
            title="Xóa hẳn các page đã chọn khỏi hệ thống, kèm top content của chúng"
            style={{
              height: 32,
              padding: "0 12px",
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
              border: `1px solid ${askDelete ? "var(--danger)" : "var(--border-strong)"}`,
              background: askDelete ? "var(--danger)" : "transparent",
              color: askDelete ? "#fff" : "var(--danger)",
            }}
          >
            {askDelete ? `Bấm lần nữa để xóa ${ids.length} page` : `Xóa ${ids.length} page`}
          </button>

          <button
            onClick={() => {
              setPicked({});
              setAskDelete(false);
            }}
            style={{ ...btnGhost, height: 32, fontSize: 12.5 }}
          >
            Bỏ chọn
          </button>
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: COLS,
          alignItems: "center",
          gap: 10,
          padding: "9px 18px",
          borderTop: ids.length ? "none" : "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          fontSize: 11.5,
          fontWeight: 600,
          color: "var(--muted)",
        }}
      >
        <input
          type="checkbox"
          checked={allOn}
          onChange={() =>
            setPicked((prev) => {
              const next = { ...prev };
              rows.forEach((p) => (next[p.id] = !allOn));
              return next;
            })
          }
          aria-label="Chọn tất cả page đang hiển thị"
          style={{ width: 15, height: 15, accentColor: "var(--accent)" }}
        />
        <span>Page</span>
        <span title="Độ hot theo tổng views: 5⚡ ≥100K · 4⚡ ≥50K · 3⚡ ≥20K · 2⚡ ≥5K · 1⚡ <5K">Độ hot</span>
        <span title="Hạng quy mô theo số follower">Hạng</span>
        <span>Ngách</span>
        <span>Nhóm</span>
        <span>Sub-group</span>
        <span style={{ textAlign: "right" }}>Tổng views</span>
        <span style={{ textAlign: "right" }}>Thao tác</span>
      </div>

      <div className="crm-scroll" style={{ maxHeight: 560, overflow: "auto" }}>
        {rows.map((p) => {
          const niche = niches.find((n) => n.id === p.nicheId);
          const groupSubs = subs.filter((s) => s.groupId === p.groupId);
          return (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: COLS,
                alignItems: "center",
                gap: 10,
                padding: "8px 18px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <input
                type="checkbox"
                checked={!!picked[p.id]}
                onChange={() => setPicked((s) => ({ ...s, [p.id]: !s[p.id] }))}
                aria-label={`Chọn ${p.name}`}
                style={{ width: 15, height: 15, accentColor: "var(--accent)" }}
              />

              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <Avatar name={p.name} src={p.image} size={26} radius={6} fontSize={10} />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={p.name}
                >
                  {p.name}
                  {multi && (
                    <span style={{ marginLeft: 7, fontSize: 11, color: "var(--muted)" }}>
                      · {ownerName(p.userId)}
                    </span>
                  )}
                </span>
              </div>

              <HotMeter level={hotLevel(p.views)} />
              <RankBadge rank={followerRank(p.follower)} />

              <select
                value={p.nicheId}
                onChange={(e) => onAssignNiche(p.id, e.target.value)}
                style={{
                  ...select,
                  width: "100%",
                  color: niche?.color ?? "var(--text)",
                  background: niche ? tint(niche.color) : "var(--surface)",
                  fontWeight: 600,
                }}
                aria-label={`Ngách của ${p.name}`}
              >
                {ownedBy(niches, p.userId).map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>

              <select
                value={p.groupId}
                onChange={(e) => {
                  const first = subs.find((s) => s.groupId === e.target.value);
                  if (first) askMove(p, "group", first.groupId, first.id);
                }}
                style={{ ...select, width: "100%" }}
                aria-label={`Nhóm của ${p.name}`}
              >
                {ownedBy(groups, p.userId)
                  .filter((g) => g.id === p.groupId || subs.some((x) => x.groupId === g.id))
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </select>

              <select
                value={p.subId}
                onChange={(e) => askMove(p, "sub", p.groupId, e.target.value)}
                style={{ ...select, width: "100%" }}
                aria-label={`Sub-group của ${p.name}`}
              >
                {groupSubs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>

              <span style={{ ...tnum, fontSize: 12.5, textAlign: "right" }}>{int(p.views)}</span>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => onDeletePage(p.id)}
                  style={{ ...btnMini, color: "var(--danger)" }}
                  title="Xóa page khỏi hệ thống"
                >
                  Xóa
                </button>
              </div>
            </div>
          );
        })}

        {rows.length === 0 && (
          <div style={{ padding: "18px", fontSize: 12.5, color: "var(--muted)" }}>
            Không có page nào khớp bộ lọc.
          </div>
        )}
      </div>
      </div>

      {moveAsk && (
        <MoveConfirm ask={moveAsk} onCancel={() => setMoveAsk(null)} onConfirm={confirmMove} />
      )}
    </div>
  );
}
