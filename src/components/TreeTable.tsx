"use client";

import { useState } from "react";
import { dec1, int, nicheById, pct, statusOf, statusStyle, vShort } from "@/lib/format";
import { caret, treeCols, tnum } from "@/lib/ui";
import { followerRank, hotLevel, postsPerDay, REPORT_DAYS } from "@/lib/rank";
import type { Group, Niche, Page, Sub } from "@/lib/types";
import { Avatar, HotMeter, NicheTag, RankBadge, StatusBadge } from "./Atoms";

const GRID = {
  display: "grid",
  gridTemplateColumns: treeCols,
  alignItems: "center",
  borderBottom: "1px solid var(--border)",
} as const;

/**
 * Bảng cây Nhóm → Sub-group → Page.
 * Kéo dòng page thả vào sub-group để chuyển nhóm; tick để bulk-edit.
 */
export default function TreeTable({
  groups,
  subs,
  pages,
  niches,
  selected,
  onToggleSelect,
  onSelectMany,
  onOpenPage,
  onMovePage,
}: {
  groups: Group[];
  subs: Sub[];
  pages: Page[];
  niches: Niche[];
  selected: Record<string, boolean>;
  onToggleSelect: (id: string) => void;
  onSelectMany: (ids: string[], on: boolean) => void;
  onOpenPage: (id: string) => void;
  onMovePage: (pageId: string, groupId: string, subId: string) => void;
}) {
  // Nhóm 1 & sub-group đầu mở sẵn.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() =>
    groups[0] ? { [groups[0].id]: true } : {},
  );
  const [subExpanded, setSubExpanded] = useState<Record<string, boolean>>(() =>
    subs[0] ? { [subs[0].id]: true } : {},
  );
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <div>
      {/* header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: treeCols,
          padding: "8px 18px",
          background: "var(--surface-2)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          fontSize: 11.5,
          fontWeight: 600,
          color: "var(--muted)",
        }}
      >
        <div />
        <div>Tên</div>
        <div>Ngách</div>
        <div title="Độ hot theo tổng views: 5⚡ ≥100K · 4⚡ ≥50K · 3⚡ ≥20K · 2⚡ ≥5K · 1⚡ <5K">Độ hot</div>
        <div style={{ textAlign: "right" }} title="Số follower hiện tại theo báo cáo gần nhất">
          Follower
        </div>
        <div title="Hạng quy mô theo số follower">Hạng</div>
        <div style={{ textAlign: "right" }}>Page</div>
        <div style={{ textAlign: "right" }}>Tổng views</div>
        <div
          style={{ textAlign: "right" }}
          title={`Số bài đăng trung bình mỗi ngày: tổng bài trong kỳ chia ${REPORT_DAYS} ngày`}
        >
          Post/ngày
        </div>
        <div style={{ textAlign: "right" }}>Tương tác</div>
        <div style={{ textAlign: "right" }}>Trạng thái</div>
      </div>

      {groups.map((g) => {
        const gpages = pages.filter((p) => p.groupId === g.id);
        const gviews = gpages.reduce((s, p) => s + p.views, 0);
        const gfollower = gpages.reduce((s, p) => s + p.follower, 0);
        const gposts = gpages.reduce((s, p) => s + p.posts, 0);
        const grate = gpages.length ? gpages.reduce((s, p) => s + p.rate, 0) / gpages.length : 0;
        const gppi = gpages.length ? gpages.reduce((s, p) => s + p.ppi, 0) / gpages.length : 0;

        const mixIds = [...new Set(gpages.map((p) => p.nicheId))];
        const mix =
          mixIds
            .slice(0, 2)
            .map((id) => nicheById(niches, id).name)
            .join(", ") + (mixIds.length > 2 ? "…" : "");

        const isOpen = !!expanded[g.id];
        const allChecked = gpages.length > 0 && gpages.every((p) => selected[p.id]);

        return (
          <div key={g.id}>
            {/* dòng nhóm lớn */}
            <div
              onClick={() => setExpanded((s) => ({ ...s, [g.id]: !s[g.id] }))}
              style={{
                ...GRID,
                padding: "11px 18px",
                background: "var(--surface-2)",
                cursor: "pointer",
              }}
            >
              <div>
                <input
                  type="checkbox"
                  checked={allChecked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onSelectMany(gpages.map((p) => p.id), !allChecked)}
                  aria-label={`Chọn toàn bộ page trong ${g.name}`}
                  style={{ width: 15, height: 15, accentColor: "var(--accent)", cursor: "pointer" }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 600 }}>
                <span style={caret(isOpen, "var(--muted)", 12)}>▸</span>
                {g.name}
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--faint)" }}>
                  {gpages.length} page
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>{mix || "—"}</div>
              <div />
              <div style={{ textAlign: "right", ...tnum }} title={`${int(gfollower)} follower`}>
                {vShort(gfollower)}
              </div>
              <div />
              <div style={{ textAlign: "right", ...tnum }}>{gpages.length}</div>
              <div style={{ textAlign: "right", ...tnum }}>{vShort(gviews)}</div>
              <div
                style={{ textAlign: "right", ...tnum }}
                title={`${int(gposts)} bài / ${REPORT_DAYS} ngày`}
              >
                {dec1(postsPerDay(gposts))}
              </div>
              <div style={{ textAlign: "right", ...tnum }}>{pct(+grate.toFixed(1))}</div>
              <div style={{ textAlign: "right" }}>
                <span style={statusStyle(gppi)}>{statusOf(gppi).label}</span>
              </div>
            </div>

            {isOpen &&
              subs
                .filter((s) => s.groupId === g.id)
                .map((s) => {
                  const spages = gpages.filter((p) => p.subId === s.id);
                  const sviews = spages.reduce((sum, p) => sum + p.views, 0);
                  const sfollower = spages.reduce((sum, p) => sum + p.follower, 0);
                  const sposts = spages.reduce((sum, p) => sum + p.posts, 0);
                  const sOpen = !!subExpanded[s.id];

                  return (
                    <div key={s.id}>
                      {/* dòng sub-group — drop target */}
                      <div
                        onClick={() => setSubExpanded((st) => ({ ...st, [s.id]: !st[s.id] }))}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragId) onMovePage(dragId, s.groupId, s.id);
                          setDragId(null);
                        }}
                        style={{
                          ...GRID,
                          padding: "10px 18px",
                          cursor: "pointer",
                          background: dragId ? "var(--accent-soft)" : "transparent",
                        }}
                      >
                        <div />
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 9,
                            paddingLeft: 22,
                            fontWeight: 500,
                          }}
                        >
                          <span style={caret(sOpen, "var(--faint)", 11)}>▸</span>
                          {s.name}
                          <span style={{ fontSize: 11, fontWeight: 400, color: "var(--faint)" }}>
                            {spages.length} page
                          </span>
                        </div>
                        <div />
                        <div />
                        <div
                          style={{ textAlign: "right", color: "var(--muted)", ...tnum }}
                          title={`${int(sfollower)} follower`}
                        >
                          {vShort(sfollower)}
                        </div>
                        <div />
                        <div style={{ textAlign: "right", color: "var(--muted)", ...tnum }}>
                          {spages.length}
                        </div>
                        <div style={{ textAlign: "right", color: "var(--muted)", ...tnum }}>
                          {vShort(sviews)}
                        </div>
                        <div
                          style={{ textAlign: "right", color: "var(--muted)", ...tnum }}
                          title={`${int(sposts)} bài / ${REPORT_DAYS} ngày`}
                        >
                          {dec1(postsPerDay(sposts))}
                        </div>
                        <div />
                        <div />
                      </div>

                      {sOpen &&
                        spages.map((p) => {
                          const nc = nicheById(niches, p.nicheId);
                          return (
                            <div
                              key={p.id}
                              className="row-hover"
                              draggable
                              onDragStart={() => setDragId(p.id)}
                              onDragEnd={() => setDragId(null)}
                              onClick={() => onOpenPage(p.id)}
                              style={{
                                ...GRID,
                                padding: "9px 18px",
                                cursor: "grab",
                                opacity: dragId === p.id ? 0.4 : 1,
                              }}
                            >
                              <div>
                                <input
                                  type="checkbox"
                                  checked={!!selected[p.id]}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => onToggleSelect(p.id)}
                                  aria-label={`Chọn ${p.name}`}
                                  style={{
                                    width: 15,
                                    height: 15,
                                    accentColor: "var(--accent)",
                                    cursor: "pointer",
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 9,
                                  paddingLeft: 44,
                                  minWidth: 0,
                                }}
                              >
                                <span style={{ color: "var(--faint)", fontSize: 12 }}>⋮⋮</span>
                                <Avatar name={p.name} src={p.image} size={24} radius={6} fontSize={10} />
                                <span
                                  style={{
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                  }}
                                >
                                  {p.name}
                                </span>
                              </div>
                              <div>
                                <NicheTag niche={nc} />
                              </div>
                              <div>
                                <HotMeter level={hotLevel(p.views)} size={11} />
                              </div>
                              <div style={{ textAlign: "right", ...tnum }}>{int(p.follower)}</div>
                              <div>
                                <RankBadge rank={followerRank(p.follower)} size={10} />
                              </div>
                              <div style={{ textAlign: "right", color: "var(--faint)" }}>—</div>
                              <div style={{ textAlign: "right", ...tnum }}>{vShort(p.views)}</div>
                              <div
                                style={{ textAlign: "right", ...tnum }}
                                title={`${int(p.posts)} bài / ${REPORT_DAYS} ngày`}
                              >
                                {dec1(postsPerDay(p.posts))}
                              </div>
                              <div style={{ textAlign: "right", ...tnum }}>{pct(p.rate)}</div>
                              <div style={{ textAlign: "right" }}>
                                <StatusBadge ppi={p.ppi} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
          </div>
        );
      })}

      {groups.length === 0 && (
        <div style={{ padding: "22px 18px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
          Chưa có nhóm page nào. Nhóm được tạo tự động (25 page mỗi nhóm) khi nhập báo cáo
          benchmark đầu tiên.
        </div>
      )}
    </div>
  );
}
