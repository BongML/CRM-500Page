"use client";

import { useMemo } from "react";
import { int, nicheById, pct, tint, vShort } from "@/lib/format";
import { btnPrimary, cardHint, cardTitle, screenPad } from "@/lib/ui";
import { viewsSeries } from "@/lib/series";
import type { Niche, Page, Snapshot, TopPost, Trend } from "@/lib/types";
import type { Theme } from "@/lib/theme";
import { KpiCard, NicheDot } from "./Atoms";
import LineChart from "./charts/LineChart";
import DoughnutChart from "./charts/DoughnutChart";
import TopPostsTable from "./TopPostsTable";
import TrendList from "./TrendList";

/** Cần ít nhất 2 kỳ báo cáo mới vẽ được đường tăng trưởng. */
const MIN_SERIES_POINTS = 2;

const panel = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 11,
} as const;

export default function Dashboard({
  niches,
  pages,
  topPosts,
  trends,
  snapshots,
  nicheFilter,
  negThreshold,
  theme,
  onNicheFilter,
  onImport,
}: {
  niches: Niche[];
  pages: Page[];
  topPosts: TopPost[];
  trends: Trend[];
  snapshots: Snapshot[];
  nicheFilter: string | null;
  negThreshold: number;
  theme: Theme;
  onNicheFilter: (id: string | null) => void;
  onImport: () => void;
}) {
  const active = nicheFilter ? nicheById(niches, nicheFilter) : null;

  /** Mọi KPI tính thẳng từ page đã nhập, không dùng số cứng nào. */
  const kpis = useMemo(() => {
    const scope = nicheFilter ? pages.filter((p) => p.nicheId === nicheFilter) : pages;
    const n = scope.length;
    // "Active" = có bài đăng trong kỳ báo cáo gần nhất của page đó.
    const posting = scope.filter((p) => p.posts > 0).length;
    const rate = n ? scope.reduce((s, p) => s + p.rate, 0) / n : 0;

    return [
      {
        label: active ? "Page trong ngách" : "Page trong hệ thống",
        value: int(n),
        sub: n
          ? `${int(posting)} page có bài trong kỳ${active ? ` · ${active.name}` : ""}`
          : "chưa nhập báo cáo nào",
      },
      {
        label: "Tổng views",
        value: vShort(scope.reduce((s, p) => s + p.views, 0)),
        sub: active ? "cộng dồn ngách" : "toàn hệ thống",
      },
      {
        label: "Tổng Reach/ngày",
        value: vShort(scope.reduce((s, p) => s + p.reach, 0)),
        sub: "/ngày · cộng dồn",
      },
      {
        label: "Interaction rate TB",
        value: pct(+rate.toFixed(2)),
        sub: `trung bình ${int(n)} page`,
      },
    ];
  }, [pages, nicheFilter, active]);

  const series = useMemo(() => viewsSeries(snapshots, nicheFilter), [snapshots, nicheFilter]);

  const visiblePosts = useMemo(
    () => (nicheFilter ? topPosts.filter((p) => p.nicheId === nicheFilter) : topPosts),
    [topPosts, nicheFilter],
  );

  const visibleTrends = useMemo(
    () => (nicheFilter ? trends.filter((t) => t.nicheId === nicheFilter) : trends),
    [trends, nicheFilter],
  );

  if (!pages.length) {
    return (
      <div className="crm-pop" style={screenPad}>
        <div style={{ ...panel, padding: "48px 26px", textAlign: "center" }}>
          <div style={{ fontSize: 26, lineHeight: 1, color: "var(--accent)" }}>↑</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 12 }}>
            Hệ thống chưa có page nào
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--muted)",
              marginTop: 8,
              lineHeight: 1.65,
              maxWidth: 520,
              margin: "8px auto 0",
            }}
          >
            Toàn bộ số liệu đến từ báo cáo Fanpage Karma. Nhập file &ldquo;Metrics Overview&rdquo;
            để dựng danh sách page, và file &ldquo;Top 25 Posts Overview&rdquo; của cùng list page
            đó để có thêm mặt nội dung. Page trùng giữa các file sẽ tự được lọc.
          </div>
          <button onClick={onImport} style={{ ...btnPrimary, marginTop: 18 }}>
            Nhập báo cáo .xlsx
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="crm-pop" style={screenPad}>
      {active && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Đang lọc theo ngách:</span>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 10px",
              borderRadius: 20,
              border: `1px solid ${active.color}`,
              background: tint(active.color),
              color: active.color,
              fontSize: 12.5,
              fontWeight: 600,
            }}
          >
            {active.name}
            <button
              onClick={() => onNicheFilter(null)}
              aria-label="Bỏ lọc ngách"
              style={{
                border: "none",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
              }}
            >
              ×
            </button>
          </span>
        </div>
      )}

      {/* Khối 1 — KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Khối 2 — Biểu đồ */}
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 14, marginTop: 14 }}>
        <div style={{ ...panel, padding: "16px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div style={cardTitle}>Lượt xem theo kỳ báo cáo</div>
            <div style={cardHint}>
              {active ? active.name : "Toàn hệ thống"} · {series.length} kỳ đã nhập
            </div>
          </div>
          <div style={{ height: 250, marginTop: 12, position: "relative" }}>
            {series.length >= MIN_SERIES_POINTS ? (
              <LineChart points={series} theme={theme} />
            ) : (
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  color: "var(--muted)",
                  fontSize: 12.5,
                  textAlign: "center",
                  padding: "0 24px",
                  lineHeight: 1.6,
                }}
              >
                <b style={{ color: "var(--text)", fontSize: 13.5 }}>Chưa đủ mốc để vẽ</b>
                Mỗi báo cáo nhập vào chốt một mốc theo ngày cuối kỳ của báo cáo đó. Nhập thêm báo
                cáo của kỳ khác để thấy đường tăng trưởng.
              </div>
            )}
          </div>
        </div>

        <div style={{ ...panel, padding: "16px 18px" }}>
          <div style={cardTitle}>Phân bổ page theo ngách</div>
          <div style={{ ...cardHint, marginTop: 2 }}>Click 1 phần để lọc dashboard</div>
          <div style={{ height: 200, marginTop: 8, position: "relative" }}>
            <DoughnutChart
              niches={niches}
              theme={theme}
              onSlice={(id) => onNicheFilter(nicheFilter === id ? null : id)}
            />
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", marginTop: 12 }}>
            {niches.map((n) => (
              <button
                key={n.id}
                onClick={() => onNicheFilter(nicheFilter === n.id ? null : n.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  fontSize: 12,
                  color: "var(--text)",
                  padding: 0,
                }}
              >
                <NicheDot color={n.color} size={10} radius={3} />
                {n.name}
                <span style={{ color: "var(--faint)" }}>{n.aggPages} page</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Khối 3 — Top nội dung & hashtag */}
      <div style={{ display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 14, marginTop: 14 }}>
        <TopPostsTable posts={visiblePosts} niches={niches} negThreshold={negThreshold} />
        <TrendList trends={visibleTrends} niches={niches} />
      </div>
    </div>
  );
}
