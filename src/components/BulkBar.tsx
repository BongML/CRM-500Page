"use client";

import type { Niche } from "@/lib/types";
import { NicheDot } from "./Atoms";

/** Thanh bulk nổi giữa dưới màn khi có page được tick. */
export default function BulkBar({
  count,
  niches,
  onAssign,
  onClear,
}: {
  count: number;
  niches: Niche[];
  onAssign: (nicheId: string) => void;
  onClear: () => void;
}) {
  return (
    <div
      className="crm-pop-fast"
      style={{
        position: "fixed",
        left: "50%",
        transform: "translateX(-50%)",
        bottom: 22,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 14,
        background: "var(--text)",
        color: "var(--bg)",
        borderRadius: 12,
        padding: "10px 12px 10px 18px",
        boxShadow: "0 12px 34px rgba(15,18,25,.32)",
      }}
    >
      <span style={{ fontSize: 13, fontWeight: 600 }}>{count} page đã chọn</span>
      <span style={{ fontSize: 12, opacity: 0.7 }}>Gán ngách:</span>
      <div style={{ display: "flex", gap: 7 }}>
        {niches.map((n) => (
          <button
            key={n.id}
            onClick={() => onAssign(n.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              border: "1px solid rgba(255,255,255,.2)",
              borderRadius: 7,
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            <NicheDot color={n.color} />
            {n.name}
          </button>
        ))}
      </div>
      <button
        onClick={onClear}
        style={{
          border: "none",
          background: "transparent",
          color: "inherit",
          cursor: "pointer",
          fontSize: 12,
          opacity: 0.75,
          padding: "6px 8px",
        }}
      >
        Bỏ chọn
      </button>
    </div>
  );
}
