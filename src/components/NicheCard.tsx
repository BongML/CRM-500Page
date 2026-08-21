"use client";

import { pct, tint, vShort } from "@/lib/format";
import { tnum } from "@/lib/ui";
import type { Niche } from "@/lib/types";

/** Card tổng hợp 1 ngách — viền trên 3px màu ngách. */
export default function NicheCard({ niche, onEdit }: { niche: Niche; onEdit: () => void }) {
  return (
    <div
      onClick={onEdit}
      title="Chỉnh ngách"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 11,
        padding: 15,
        borderTop: `3px solid ${niche.color}`,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: tint(niche.color),
            color: niche.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 14,
          }}
        >
          {niche.icon}
        </div>
        <div style={{ fontWeight: 600, fontSize: 13.5 }}>{niche.name}</div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Page</div>
          <div style={{ fontWeight: 700, fontSize: 16, ...tnum }}>{niche.aggPages}</div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "var(--muted)" }}>Tổng views</div>
          <div style={{ fontWeight: 700, fontSize: 16, ...tnum }}>{vShort(niche.aggViews)}</div>
        </div>
      </div>

      <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--muted)" }}>
        Tương tác TB <b style={{ color: "var(--text)" }}>{pct(niche.aggRate)}</b>
      </div>
    </div>
  );
}
