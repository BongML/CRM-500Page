"use client";

import { int, negStyle, nicheById, pct, tint, vShort } from "@/lib/format";
import { dayLabel } from "@/lib/series";
import { cardHint, cardTitle, screenPad, thBase, tnum } from "@/lib/ui";
import type { Group, Niche, Page, TopPost } from "@/lib/types";
import { followerRank, hotMeta, rankMeta, type HotLevel } from "@/lib/rank";
import { Avatar, HotMeter, MiniKpi, NicheDot, PostCaption, PostThumb, RankBadge, isVideoPost } from "./Atoms";

/** Ngưỡng chênh lệch PPI để ra khuyến nghị giữ / đổi ngách. */
const DIFF_BAND = 6;

type Suggestion = {
  head: string;
  niche: string;
  color: string;
  tintBg: string;
  border: string;
  text: string;
};

function suggest(page: Page, niche: Niche, niches: Niche[]): Suggestion {
  const diff = page.ppi - niche.aggPpi;

  if (diff >= DIFF_BAND) {
    return {
      head: "Giữ nguyên ngách",
      niche: niche.name,
      color: "var(--good)",
      tintBg: "rgba(22,163,74,.10)",
      border: "rgba(22,163,74,.3)",
      text: `PPI của page cao hơn trung bình ngách ${pct(Math.abs(diff))}. Page đang chạy tốt, nên duy trì và nhân bản content.`,
    };
  }

  if (diff <= -DIFF_BAND) {
    // Ngách mà page vượt trội nhất so với PPI trung bình của ngách đó.
    const better = niches
      .filter((x) => x.id !== niche.id)
      .sort((a, b) => page.ppi - a.aggPpi - (page.ppi - b.aggPpi))
      .reverse()[0];

    if (better) {
      return {
        head: "Cân nhắc đổi sang",
        niche: better.name,
        color: better.color,
        tintBg: tint(better.color),
        border: better.color + "55",
        text: `PPI thấp hơn TB ngách hiện tại ${pct(Math.abs(diff))}. So với ngách "${better.name}" (TB ${pct(better.aggPpi)}), page có khả năng hiệu quả hơn.`,
      };
    }
  }

  return {
    head: "Ổn định",
    niche: niche.name,
    color: "var(--warn)",
    tintBg: "rgba(217,119,6,.10)",
    border: "rgba(217,119,6,.3)",
    text: "PPI của page sát trung bình ngách. Theo dõi thêm 1–2 tuần trước khi điều chỉnh.",
  };
}

export default function PageDetail({
  page,
  niches,
  groups,
  topPosts,
  hot,
  negThreshold,
  onBack,
  onChangeNiche,
}: {
  page: Page;
  niches: Niche[];
  groups: Group[];
  topPosts: TopPost[];
  /** Bậc độ hot đã tính trên toàn hệ thống (xem lib/rank.ts). */
  hot: HotLevel;
  negThreshold: number;
  onBack: () => void;
  onChangeNiche: (nicheId: string) => void;
}) {
  const niche = nicheById(niches, page.nicheId);
  const group = groups.find((g) => g.id === page.groupId);
  const rank = followerRank(page.follower);
  const diff = page.ppi - niche.aggPpi;
  const sug = suggest(page, niche, niches);

  const kpis = [
    { label: "Follower", value: int(page.follower) },
    { label: "Số bài đăng", value: int(page.posts) },
    { label: "Lượt thích", value: int(page.likes) },
    { label: "Bình luận", value: int(page.comments) },
    { label: "Interaction rate", value: pct(page.rate) },
    { label: "Reach/ngày", value: vShort(page.reach) },
    { label: "Page Perf. Index", value: pct(page.ppi) },
    { label: "Tổng views", value: vShort(page.views) },
  ];

  // Mặt nội dung của chính page này: bài từ báo cáo "Top 25 Posts Overview" đã
  // được nối về page qua Profile-ID khi nhập.
  const posts = topPosts.filter((p) => p.pageId === page.id).slice(0, 8);

  return (
    <div className="crm-pop" style={screenPad}>
      <button
        onClick={onBack}
        style={{
          border: "none",
          background: "transparent",
          color: "var(--muted)",
          cursor: "pointer",
          fontSize: 12.5,
          padding: "0 0 14px",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        ← Quay lại danh mục
      </button>

      {/* Header card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 11,
          padding: "18px 20px",
          display: "flex",
          alignItems: "center",
          gap: 16,
        }}
      >
        <Avatar name={page.name} size={56} radius={12} fontSize={20} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{page.name}</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "6px 12px",
              marginTop: 6,
              fontSize: 12.5,
              color: "var(--muted)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "3px 9px",
                borderRadius: 20,
                background: tint(niche.color),
                color: niche.color,
                fontWeight: 500,
              }}
            >
              <NicheDot color={niche.color} />
              {niche.name}
            </span>
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
              title={`${hot}/5 ⚡ — ${hotMeta(hot).label}: ${hotMeta(hot).note}`}
            >
              <HotMeter level={hot} />
              {hotMeta(hot).label}
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <RankBadge rank={rank} />
              {rankMeta(rank).label}
            </span>
            <span>
              {vShort(page.follower)} follower · thuộc {group?.name ?? "—"}
              {page.reportedAt ? ` · số liệu tới ${dayLabel(page.reportedAt)}` : ""}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Đổi ngách:</span>
          <select
            value={page.nicheId}
            onChange={(e) => onChangeNiche(e.target.value)}
            aria-label="Đổi ngách của page"
            style={{
              height: 34,
              padding: "0 26px 0 10px",
              border: "1px solid var(--border-strong)",
              borderRadius: 8,
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 12.5,
              cursor: "pointer",
            }}
          >
            {niches.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI grid 4×2 — khớp cột Karmar Metrics Overview */}
      <div
        style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 14 }}
      >
        {kpis.map((k) => (
          <MiniKpi key={k.label} {...k} />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.7fr 1fr",
          gap: 14,
          marginTop: 14,
          alignItems: "start",
        }}
      >
        {/* Top post của page */}
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
              padding: "15px 18px 12px",
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <span style={cardTitle}>Top post của page</span>
            <span style={cardHint}>{posts.length} bài từ báo cáo top content</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <th style={{ ...thBase, textAlign: "left", padding: "9px 16px" }}>Bài đăng</th>
                <th style={{ ...thBase, padding: "9px 12px" }}>Tương tác</th>
                <th style={{ ...thBase, padding: "9px 12px" }}>Reach</th>
                <th style={{ ...thBase, padding: "9px 16px" }}>Neg.</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr
                  key={p.id}
                  className="row-hover"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td style={{ padding: "10px 16px" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <PostThumb
                        src={p.image}
                        seed={p.caption + p.id}
                        size={48}
                        video={isVideoPost(p.link)}
                      />
                      <div style={{ minWidth: 0 }}>
                        <PostCaption caption={p.caption} link={p.link} maxWidth={260} />
                        <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>
                          {p.time}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td
                    style={{ textAlign: "right", padding: "10px 12px", fontWeight: 600, ...tnum }}
                  >
                    {pct(p.rate)}
                  </td>
                  <td style={{ textAlign: "right", padding: "10px 12px", ...tnum }}>
                    {vShort(p.reach)}
                  </td>
                  <td style={{ textAlign: "right", padding: "10px 16px" }}>
                    <span style={negStyle(p.neg, negThreshold, false)}>{pct(p.neg)}</span>
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{ padding: "16px", color: "var(--muted)", fontSize: 12.5, lineHeight: 1.6 }}
                  >
                    Page này chưa có dữ liệu nội dung. Nhập báo cáo &ldquo;Top 25 Posts
                    Overview&rdquo; của cùng list page để ghép thêm mặt nội dung.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Gợi ý ngách */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 11,
            padding: "16px 18px",
          }}
        >
          <div style={cardTitle}>Gợi ý ngách</div>
          <div
            style={{
              marginTop: 12,
              padding: 14,
              borderRadius: 9,
              background: sug.tintBg,
              border: `1px solid ${sug.border}`,
            }}
          >
            <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{sug.head}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6, color: sug.color }}>
              {sug.niche}
            </div>
            <div
              style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, lineHeight: 1.55 }}
            >
              {sug.text}
            </div>
          </div>

          <div style={{ marginTop: 14, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span>PPI của page</span>
              <b style={{ color: "var(--text)" }}>{pct(page.ppi)}</b>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span>PPI TB ngách hiện tại</span>
              <b style={{ color: "var(--text)" }}>{pct(niche.aggPpi)}</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
              <span>Chênh lệch</span>
              <b style={{ color: diff >= 0 ? "var(--good)" : "var(--danger)" }}>
                {(diff >= 0 ? "+" : "") + pct(+diff.toFixed(0))}
              </b>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
