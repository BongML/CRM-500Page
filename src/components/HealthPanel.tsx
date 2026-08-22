"use client";

import { useMemo } from "react";
import { dec1, int, pct, vShort } from "@/lib/format";
import { cardHint, cardTitle, tnum } from "@/lib/ui";
import { hotBands, rankBands, statusBands, type PageStats } from "@/lib/metrics";
import { rankMeta } from "@/lib/rank";
import type { Page } from "@/lib/types";
import { HotMeter, RankBadge, StackBar } from "./Atoms";

/**
 * Sức khỏe của cả hệ thống page trong một khối.
 *
 * Dashboard cũ chỉ trả lời "hệ thống to bao nhiêu"; khối này trả lời "hệ thống
 * đang khỏe hay yếu" — bao nhiêu page hiệu quả so với bao nhiêu page cần review,
 * bao nhiêu page thực sự đăng bài trong kỳ, và lượng follower đang có sinh ra
 * được bao nhiêu view. Tất cả đều tính từ page đã nhập, không có số cứng.
 */
export default function HealthPanel({ pages, stats }: { pages: Page[]; stats: PageStats }) {
  const status = useMemo(() => statusBands(pages), [pages]);
  const hot = useMemo(() => hotBands(pages), [pages]);
  const ranks = useMemo(() => rankBands(pages), [pages]);

  const maxHot = Math.max(1, ...hot.map((b) => b.count));
  const activeShare = stats.pages ? (stats.posting / stats.pages) * 100 : 0;
  /** Mỗi follower đang mang lại bao nhiêu view — đo mức khai thác lượng sẵn có. */
  const viewsPerFollower = stats.follower ? stats.views / stats.follower : 0;

  const statusParts = status.map((b) => ({ ...b }));

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 11,
        padding: "16px 18px 18px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={cardTitle}>Sức khỏe hệ thống page</div>
        <div style={cardHint}>{int(stats.pages)} page đang theo dõi</div>
      </div>

      {/* ---- Trạng thái theo PPI ---- */}
      <div style={{ marginTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
          <span style={{ color: "var(--muted)" }}>Trạng thái theo PPI</span>
          <span style={{ color: "var(--faint)" }}>
            {status[0].count > 0 && stats.pages
              ? `${Math.round((status[0].count / stats.pages) * 100)}% hiệu quả`
              : "—"}
          </span>
        </div>
        <div style={{ marginTop: 7 }}>
          <StackBar parts={statusParts} height={11} />
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 9 }}>
          {status.map((b) => (
            <span key={b.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
              <span
                style={{ width: 9, height: 9, borderRadius: 3, background: b.color, flex: "none" }}
              />
              {b.label}
              <b style={{ ...tnum }}>{int(b.count)}</b>
            </span>
          ))}
        </div>
      </div>

      {/* ---- Độ hot ---- */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>
          Phân bổ độ hot ⚡ (theo tổng views của page)
        </div>
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 5 }}>
          {hot.map((b) => (
            <div key={b.key} style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span style={{ width: 62, flex: "none" }}>
                <HotMeter level={b.level} size={10} />
              </span>
              <span
                style={{
                  flex: 1,
                  height: 7,
                  borderRadius: 4,
                  background: "var(--surface-2)",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: `${(b.count / maxHot) * 100}%`,
                    height: "100%",
                    background: b.color,
                  }}
                />
              </span>
              <span
                style={{
                  width: 46,
                  textAlign: "right",
                  fontSize: 11.5,
                  color: b.count ? "var(--muted)" : "var(--faint)",
                  ...tnum,
                }}
              >
                {b.count ? int(b.count) : "—"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Hạng quy mô ---- */}
      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 12, color: "var(--muted)" }}>Quy mô theo follower</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "7px 12px", marginTop: 9 }}>
          {ranks.map((r) => (
            <span
              key={r.rank}
              title={rankMeta(r.rank).label}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12 }}
            >
              <RankBadge rank={r.rank} size={10} />
              <b style={{ color: r.count ? "var(--text)" : "var(--faint)", ...tnum }}>
                {r.count ? int(r.count) : "—"}
              </b>
            </span>
          ))}
        </div>
      </div>

      {/* ---- Chỉ số vận hành ---- */}
      <div
        style={{
          marginTop: 18,
          paddingTop: 14,
          borderTop: "1px solid var(--border)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
          gap: 14,
        }}
      >
        <Stat
          label="Page có bài trong kỳ"
          value={`${int(stats.posting)}/${int(stats.pages)}`}
          sub={`${pct(+activeShare.toFixed(1))} · ${int(stats.silent)} page im lặng`}
          warn={stats.silent > 0}
        />
        <Stat
          label="Bài đăng / ngày"
          value={dec1(stats.postsPerDay)}
          sub={`${int(stats.posts)} bài trong kỳ`}
        />
        <Stat
          label="Tương tác"
          value={vShort(stats.interactions)}
          sub={`${vShort(stats.likes)} like · ${vShort(stats.comments)} bình luận`}
        />
        <Stat
          label="Views / follower"
          value={dec1(viewsPerFollower)}
          sub={`trên ${vShort(stats.follower)} follower`}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  warn,
}: {
  label: string;
  value: string;
  sub: string;
  warn?: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{label}</div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          marginTop: 3,
          color: warn ? "var(--warn)" : "var(--text)",
          ...tnum,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}
