"use client";

import { useMemo, useState } from "react";
import { avatarBg, dec1, initials, int, nicheById, pct, statusOf, statusStyle, vShort } from "@/lib/format";
import { caret, treeCols, tnum } from "@/lib/ui";
import { followerRank, hotLevel, postsPerDay, REPORT_DAYS } from "@/lib/rank";
import type { Group, Niche, Owner, Page, Sub } from "@/lib/types";
import { Avatar, HotMeter, NicheTag, RankBadge, StatusBadge, VisitPageButton } from "./Atoms";

const GRID = {
  display: "grid",
  gridTemplateColumns: treeCols,
  alignItems: "center",
  borderBottom: "1px solid var(--border)",
} as const;

/** Thụt lề thêm cho mọi cấp khi có thêm cấp người dùng ở trên cùng. */
const OWNER_INDENT = 18;

/**
 * Bảng cây Nhóm → Sub-group → Page.
 *
 * Khi tài khoản tổng xem gộp nhiều tài khoản, `owners` có từ 2 người trở lên và
 * cây mọc thêm **một cấp trên cùng: người dùng** (Người dùng → Nhóm page →
 * Sub-group → Page). Nhóm page vốn đã thuộc về đúng một tài khoản (`group.userId`)
 * nên cấp này chỉ là gom lại, không đổi dữ liệu.
 *
 * Kéo dòng page thả vào sub-group để chuyển nhóm; tick để bulk-edit.
 */
export default function TreeTable({
  groups,
  subs,
  pages,
  niches,
  owners,
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
  /** Chủ sở hữu dữ liệu. Từ 2 người trở lên thì bật cấp "người dùng". */
  owners: Owner[];
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
  // Mở sẵn người dùng đang giữ nhóm đầu tiên, để cây không hiện ra ở trạng thái
  // đóng kín hoàn toàn khi tài khoản tổng vừa vào màn danh mục.
  const [ownerExpanded, setOwnerExpanded] = useState<Record<string, boolean>>(() =>
    groups[0]?.userId ? { [groups[0].userId]: true } : {},
  );
  const [dragId, setDragId] = useState<string | null>(null);

  const byOwner = owners.length > 1;
  const indent = byOwner ? OWNER_INDENT : 0;

  /**
   * Cây được cắt thành các mảng: một mảng cho mỗi người dùng khi xem gộp, hoặc
   * đúng một mảng không tên khi chỉ có một không gian dữ liệu. Nhóm không khớp
   * chủ nào (dữ liệu lệch) vẫn được xếp cuối để không biến mất khỏi giao diện.
   */
  const sections = useMemo(() => {
    if (!byOwner) return [{ owner: null as Owner | null, groups }];

    const known = new Set(owners.map((o) => o.id));
    const out = owners.map((owner) => ({
      owner,
      groups: groups.filter((g) => g.userId === owner.id),
    }));

    const orphans = groups.filter((g) => !g.userId || !known.has(g.userId));
    if (orphans.length) out.push({ owner: null as unknown as Owner, groups: orphans });
    return out;
  }, [byOwner, groups, owners]);

  /** Số liệu cộng dồn của một tập page — dùng cho cả dòng người dùng và dòng nhóm. */
  const roll = (list: Page[]) => ({
    views: list.reduce((s, p) => s + p.views, 0),
    follower: list.reduce((s, p) => s + p.follower, 0),
    posts: list.reduce((s, p) => s + p.posts, 0),
    rate: list.length ? list.reduce((s, p) => s + p.rate, 0) / list.length : 0,
    ppi: list.length ? list.reduce((s, p) => s + p.ppi, 0) / list.length : 0,
  });

  const renderGroup = (g: Group) => {
    const gpages = pages.filter((p) => p.groupId === g.id);
    const agg = roll(gpages);

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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              paddingLeft: indent,
              fontWeight: 600,
              minWidth: 0,
            }}
          >
            <span style={caret(isOpen, "var(--muted)", 12)}>▸</span>
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {g.name}
            </span>
            <span style={{ fontSize: 11, fontWeight: 500, color: "var(--faint)", flex: "none" }}>
              {gpages.length} page
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{mix || "—"}</div>
          <div />
          <div style={{ textAlign: "right", ...tnum }} title={`${int(agg.follower)} follower`}>
            {vShort(agg.follower)}
          </div>
          <div />
          <div style={{ textAlign: "right", ...tnum }}>{gpages.length}</div>
          <div style={{ textAlign: "right", ...tnum }}>{vShort(agg.views)}</div>
          <div
            style={{ textAlign: "right", ...tnum }}
            title={`${int(agg.posts)} bài / ${REPORT_DAYS} ngày`}
          >
            {dec1(postsPerDay(agg.posts))}
          </div>
          <div style={{ textAlign: "right", ...tnum }}>{pct(+agg.rate.toFixed(1))}</div>
          <div style={{ textAlign: "right" }}>
            <span style={statusStyle(agg.ppi)}>{statusOf(agg.ppi).label}</span>
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
                        paddingLeft: 22 + indent,
                        fontWeight: 500,
                        minWidth: 0,
                      }}
                    >
                      <span style={caret(sOpen, "var(--faint)", 11)}>▸</span>
                      <span
                        style={{
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {s.name}
                      </span>
                      <span
                        style={{ fontSize: 11, fontWeight: 400, color: "var(--faint)", flex: "none" }}
                      >
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
                              paddingLeft: 44 + indent,
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
                            <VisitPageButton page={p} compact />
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
  };

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
        <div>{byOwner ? "Người dùng / Nhóm / Page" : "Tên"}</div>
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

      {sections.map((sec, i) => {
        if (!sec.owner) return <div key={`plain-${i}`}>{sec.groups.map(renderGroup)}</div>;

        const owner = sec.owner;
        const opages = pages.filter((p) => p.userId === owner.id);
        const agg = roll(opages);
        const isOpen = !!ownerExpanded[owner.id];
        const allChecked = opages.length > 0 && opages.every((p) => selected[p.id]);
        const nicheCount = new Set(opages.map((p) => p.nicheId)).size;

        return (
          <div key={owner.id}>
            {/* dòng người dùng — cấp trên cùng khi xem gộp nhiều tài khoản */}
            <div
              onClick={() => setOwnerExpanded((s) => ({ ...s, [owner.id]: !s[owner.id] }))}
              title={owner.email}
              style={{
                ...GRID,
                padding: "12px 18px",
                background: "var(--accent-soft)",
                borderBottom: "1px solid var(--border-strong)",
                cursor: "pointer",
              }}
            >
              <div>
                <input
                  type="checkbox"
                  checked={allChecked}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onSelectMany(opages.map((p) => p.id), !allChecked)}
                  aria-label={`Chọn toàn bộ page của ${owner.name || owner.email}`}
                  style={{ width: 15, height: 15, accentColor: "var(--accent)", cursor: "pointer" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <span style={caret(isOpen, "var(--accent)", 12)}>▸</span>
                <span
                  aria-hidden
                  style={{
                    width: 22,
                    height: 22,
                    flex: "none",
                    borderRadius: 6,
                    background: avatarBg(owner.name || owner.email),
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9.5,
                    fontWeight: 700,
                  }}
                >
                  {initials(owner.name || owner.email)}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {owner.name || owner.email}
                </span>
                <span style={{ fontSize: 11, fontWeight: 500, color: "var(--muted)", flex: "none" }}>
                  {sec.groups.length} nhóm
                </span>
              </div>

              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {nicheCount ? `${nicheCount} ngách` : "—"}
              </div>
              <div />
              <div style={{ textAlign: "right", fontWeight: 600, ...tnum }} title={`${int(agg.follower)} follower`}>
                {vShort(agg.follower)}
              </div>
              <div />
              <div style={{ textAlign: "right", fontWeight: 600, ...tnum }}>{opages.length}</div>
              <div style={{ textAlign: "right", fontWeight: 600, ...tnum }}>{vShort(agg.views)}</div>
              <div
                style={{ textAlign: "right", fontWeight: 600, ...tnum }}
                title={`${int(agg.posts)} bài / ${REPORT_DAYS} ngày`}
              >
                {dec1(postsPerDay(agg.posts))}
              </div>
              <div style={{ textAlign: "right", fontWeight: 600, ...tnum }}>
                {pct(+agg.rate.toFixed(1))}
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={statusStyle(agg.ppi)}>{statusOf(agg.ppi).label}</span>
              </div>
            </div>

            {isOpen && sec.groups.map(renderGroup)}

            {isOpen && !sec.groups.length && (
              <div
                style={{
                  padding: "14px 18px 14px 40px",
                  fontSize: 12.5,
                  color: "var(--muted)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                Tài khoản này chưa có nhóm page nào.
              </div>
            )}
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
