"use client";

import { useMemo, useState } from "react";
import { int, vShort } from "@/lib/format";
import { cardHint, cardTitle } from "@/lib/ui";
import { HOT_BAND_LIST, RANK_LIST, followerRank, hotLevel } from "@/lib/rank";
import type { Page } from "@/lib/types";
import { HotMeter, RankBadge } from "./Atoms";

/**
 * Giải thích hai cách xếp loại page cho người dùng, kèm số page đang rơi vào
 * từng bậc — để thấy ngay mặt bằng hệ thống đang đứng ở đâu so với thang chuẩn,
 * chứ không chỉ đọc ngưỡng suông.
 */
export default function ClassifyLegend({ pages }: { pages: Page[] }) {
  const [open, setOpen] = useState(false);

  const counts = useMemo(() => {
    const hot = new Map<number, number>();
    const rank = new Map<string, number>();
    for (const p of pages) {
      const h = hotLevel(p.views);
      const r = followerRank(p.follower);
      hot.set(h, (hot.get(h) ?? 0) + 1);
      rank.set(r, (rank.get(r) ?? 0) + 1);
    }
    return { hot, rank };
  }, [pages]);

  const tally = (n: number) => (
    <span
      style={{
        minWidth: 62,
        textAlign: "right",
        color: n ? "var(--muted)" : "var(--faint)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {n ? `${int(n)} page` : "—"}
    </span>
  );

  const row = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "7px 2px",
    borderBottom: "1px solid var(--border)",
    fontSize: 12,
  } as const;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 11,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "13px 18px",
          border: "none",
          background: "transparent",
          color: "var(--text)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span
          style={{
            display: "inline-block",
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform .15s",
            color: "var(--muted)",
            fontSize: 12,
          }}
        >
          ▸
        </span>
        <span style={cardTitle}>Cách xếp loại page</span>
        <span style={{ ...cardHint, marginLeft: "auto" }}>
          ⚡ độ hot theo tổng views · S–F theo follower
        </span>
      </button>

      {open && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "16px 18px 18px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(330px,1fr))",
            gap: 22,
          }}
        >
          {/* ---- Độ hot ---- */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>⚡ Độ hot — theo tổng views</div>
            <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7, margin: "7px 0 0" }}>
              Chấm theo <b>mốc views cố định</b>: page đạt bao nhiêu views thì ăn bấy nhiêu ⚡,
              không phụ thuộc các page khác. Nhập thêm báo cáo không làm page nào đổi bậc trừ khi
              chính views của nó đổi. Bậc thấp là nhóm cần dồn lực đẩy tiếp cận.
            </p>

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 1 }}>
              {HOT_BAND_LIST.map((b) => (
                <div key={b.level} style={row}>
                  <span style={{ minWidth: 70, display: "inline-flex" }}>
                    <HotMeter level={b.level} />
                  </span>
                  <span style={{ fontWeight: 600, minWidth: 56 }}>{b.label}</span>
                  <span style={{ color: "var(--muted)", flex: 1 }}>
                    {b.level === 1 ? `< ${vShort(HOT_BAND_LIST[3].min)}` : `≥ ${vShort(b.min)}`} views
                  </span>
                  {tally(counts.hot.get(b.level) ?? 0)}
                </div>
              ))}
            </div>
          </div>

          {/* ---- Hạng follower ---- */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>S–F — hạng quy mô theo follower</div>
            <p style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.7, margin: "7px 0 0" }}>
              Cũng là mốc cố định, nhưng đo <b>quy mô</b> chứ không đo hiệu suất. Hai thang không
              thay thế nhau: page hạng F mà nhiều ⚡ là page mới lên view tốt — đáng nhân bản; page
              hạng cao mà 1⚡ là đang phí lượng follower sẵn có.
            </p>

            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 1 }}>
              {RANK_LIST.map((r) => (
                <div key={r.rank} style={row}>
                  <RankBadge rank={r.rank} />
                  <span style={{ color: "var(--muted)", flex: 1 }}>{r.label}</span>
                  {tally(counts.rank.get(r.rank) ?? 0)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
