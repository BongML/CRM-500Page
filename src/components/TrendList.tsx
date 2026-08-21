"use client";

import { nicheById } from "@/lib/format";
import { cardHint, cardTitle, tnum } from "@/lib/ui";
import type { Niche, Trend } from "@/lib/types";

/**
 * Hashtag nổi bật lấy từ sheet "Top 50 Hashtags" của báo cáo top content —
 * số bài dùng hashtag đó và bội số tương tác so với trung bình.
 */
export default function TrendList({ trends, niches }: { trends: Trend[]; niches: Niche[] }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 11,
        padding: "16px 18px",
      }}
    >
      <div style={cardTitle}>Hashtag nổi bật</div>
      <div style={{ ...cardHint, marginTop: 2 }}>Từ báo cáo top content · số bài & bội số tương tác</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 12 }}>
        {trends.map((t) => {
          const nc = nicheById(niches, t.nicheId);
          return (
            <div
              key={t.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 4px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500 }}>{t.term}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {t.posts} bài · <span style={{ color: nc.color }}>{nc.name}</span>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 600, color: "var(--good)", ...tnum }}>{t.rate}</div>
                <div style={{ fontSize: 10.5, color: "var(--faint)" }}>so với TB</div>
              </div>
            </div>
          );
        })}

        {trends.length === 0 && (
          <div style={{ padding: "14px 4px", fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6 }}>
            Chưa có hashtag nào. Nhập báo cáo &ldquo;Top 25 Posts Overview&rdquo; để lấy hashtag
            nổi bật của list page.
          </div>
        )}
      </div>
    </div>
  );
}
