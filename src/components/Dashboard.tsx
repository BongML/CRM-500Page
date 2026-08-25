"use client";

import { useMemo, useState } from "react";
import { dec1, int, nicheById, pct, tint, vShort } from "@/lib/format";
import { btnPrimary, cardHint, cardTitle, screenPad } from "@/lib/ui";
import { lastDelta, metricMeta, metricSeries, SNAP_METRICS, type SnapMetric } from "@/lib/series";
import { statsOf } from "@/lib/metrics";
import type { Niche, Owner, Page, Snapshot, TopPost, Trend } from "@/lib/types";
import type { Theme } from "@/lib/theme";
import { KpiCard, NicheDot } from "./Atoms";
import LineChart from "./charts/LineChart";
import DoughnutChart from "./charts/DoughnutChart";
import HealthPanel from "./HealthPanel";
import OwnerPerformance from "./OwnerPerformance";
import PageSpotlight from "./PageSpotlight";
import TopPostsTable from "./TopPostsTable";
import TrendList from "./TrendList";

/** Cần ít nhất 2 kỳ báo cáo mới vẽ được đường tăng trưởng. */
const MIN_SERIES_POINTS = 2;

const panel = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 11,
} as const;

const twoCol = { display: "grid", gridTemplateColumns: "1.7fr 1fr", gap: 14, marginTop: 14 } as const;

export default function Dashboard({
  niches,
  pages,
  topPosts,
  trends,
  snapshots,
  owners,
  nicheFilter,
  negThreshold,
  theme,
  onNicheFilter,
  onOpenPage,
  onOpenOwner,
  onImport,
}: {
  niches: Niche[];
  pages: Page[];
  topPosts: TopPost[];
  trends: Trend[];
  snapshots: Snapshot[];
  /** Chủ sở hữu dữ liệu — chỉ khác rỗng khi tài khoản tổng xem gộp toàn hệ thống. */
  owners: Owner[];
  nicheFilter: string | null;
  negThreshold: number;
  theme: Theme;
  onNicheFilter: (id: string | null) => void;
  onOpenPage: (id: string) => void;
  /** Đổi phạm vi dữ liệu sang một người nắm (chỉ tài khoản tổng có). */
  onOpenOwner?: (userId: string) => void;
  onImport: () => void;
}) {
  const [metric, setMetric] = useState<SnapMetric>("views");

  const active = nicheFilter ? nicheById(niches, nicheFilter) : null;

  /** Page trong phạm vi đang xem — mọi khối bên dưới đều tính từ đây. */
  const scoped = useMemo(
    () => (nicheFilter ? pages.filter((p) => p.nicheIds.includes(nicheFilter)) : pages),
    [pages, nicheFilter],
  );

  const stats = useMemo(() => statsOf(scoped), [scoped]);

  /**
   * Chuỗi của **mọi** chỉ số chốt được, tính một lần: KPI cần mức tăng/giảm của
   * từng chỉ số, còn biểu đồ chỉ vẽ chỉ số đang chọn.
   */
  const series = useMemo(() => {
    const out = {} as Record<SnapMetric, ReturnType<typeof metricSeries>>;
    for (const m of SNAP_METRICS) out[m.id] = metricSeries(snapshots, nicheFilter, m.id);
    return out;
  }, [snapshots, nicheFilter]);

  const deltas = useMemo(() => {
    const out = {} as Record<SnapMetric, ReturnType<typeof lastDelta>>;
    for (const m of SNAP_METRICS) out[m.id] = lastDelta(series[m.id]);
    return out;
  }, [series]);

  const chart = series[metric];
  const meta = metricMeta(metric);

  /**
   * Sáu KPI. Chỉ số nào được Snapshot chốt lại qua từng kỳ thì kèm mức tăng/giảm;
   * số bài đăng và follower chưa có trong Snapshot nên cố tình để trống thay vì
   * dựng ra một con số so sánh không có thật.
   */
  const kpis = useMemo(
    () => [
      {
        label: active ? "Page trong ngách" : "Page trong hệ thống",
        value: int(stats.pages),
        sub: stats.pages
          ? `${int(stats.posting)} page có bài trong kỳ${active ? ` · ${active.name}` : ""}`
          : "chưa nhập báo cáo nào",
        delta: deltas.pages,
      },
      {
        label: "Tổng bài đăng",
        value: int(stats.posts),
        sub: `${dec1(stats.postsPerDay)} bài/ngày`,
      },
      {
        label: "Tổng views",
        value: vShort(stats.views),
        sub: active ? "cộng dồn ngách" : "toàn hệ thống kênh",
        delta: deltas.views,
      },
      {
        label: "Tổng Reach/ngày",
        value: vShort(stats.reach),
        sub: "/ngày · cộng dồn",
        delta: deltas.reach,
      },
      {
        label: "Interaction rate TB",
        value: pct(stats.rate),
        sub: `trung bình ${int(stats.pages)} page`,
        delta: deltas.rate,
      },
      {
        label: "PPI trung bình",
        value: pct(stats.ppi),
        sub: `${vShort(stats.follower)} follower đang nắm`,
        delta: deltas.ppi,
      },
    ],
    [stats, active, deltas],
  );

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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(178px,1fr))",
          gap: 14,
        }}
      >
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Khối 2 — Biểu đồ tăng trưởng & phân bổ ngách */}
      <div style={twoCol}>
        <div style={{ ...panel, padding: "16px 18px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={cardTitle}>{meta.label} theo kỳ báo cáo</div>
              <div style={{ ...cardHint, marginTop: 2 }}>
                {active ? active.name : "Toàn hệ thống"} · {chart.length} kỳ đã nhập
                {deltas[metric] ? ` · so kỳ ${deltas[metric]!.prevLabel}` : ""}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                border: "1px solid var(--border)",
                borderRadius: 8,
                overflow: "hidden",
                flex: "none",
              }}
            >
              {SNAP_METRICS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMetric(m.id)}
                  style={{
                    padding: "6px 11px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 11.5,
                    fontWeight: metric === m.id ? 600 : 500,
                    background: metric === m.id ? "var(--accent)" : "transparent",
                    color: metric === m.id ? "#fff" : "var(--muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ height: 250, marginTop: 12, position: "relative" }}>
            {chart.length >= MIN_SERIES_POINTS ? (
              <LineChart
                points={chart}
                theme={theme}
                unit={meta.unit}
                suffix={meta.label.toLowerCase()}
              />
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

      {/* Khối 3 — Sức khỏe hệ thống & page đáng soi */}
      <div style={twoCol}>
        <HealthPanel pages={scoped} stats={stats} />
        <PageSpotlight pages={scoped} niches={niches} onOpenPage={onOpenPage} />
      </div>

      {/* Khối 4 — Hiệu suất page người nắm (chỉ khi xem gộp nhiều tài khoản) */}
      {owners.length > 1 && (
        <div style={{ marginTop: 14 }}>
          <OwnerPerformance
            pages={scoped}
            niches={niches}
            owners={owners}
            onOpenOwner={onOpenOwner}
          />
        </div>
      )}

      {/* Khối 5 — Top nội dung & hashtag */}
      <div style={twoCol}>
        <TopPostsTable posts={visiblePosts} niches={niches} negThreshold={negThreshold} />
        <TrendList trends={visibleTrends} niches={niches} />
      </div>
    </div>
  );
}
