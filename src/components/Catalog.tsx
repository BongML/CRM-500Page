"use client";

import { useState } from "react";
import { cardHint, cardTitle, screenPad } from "@/lib/ui";
import type { BarMetric, Group, Niche, Page, Sub } from "@/lib/types";
import type { Theme } from "@/lib/theme";
import BarChart from "./charts/BarChart";
import ClassifyLegend from "./ClassifyLegend";
import NicheCard from "./NicheCard";
import TreeTable from "./TreeTable";
import type { NicheDraft } from "./NicheModal";

const METRICS: { id: BarMetric; label: string }[] = [
  { id: "views", label: "Tổng views" },
  { id: "rate", label: "Tương tác" },
  { id: "ppi", label: "PPI" },
];

export default function Catalog({
  niches,
  groups,
  subs,
  pages,
  selected,
  theme,
  onToggleSelect,
  onSelectMany,
  onOpenPage,
  onMovePage,
  onOpenModal,
}: {
  niches: Niche[];
  groups: Group[];
  subs: Sub[];
  pages: Page[];
  selected: Record<string, boolean>;
  theme: Theme;
  onToggleSelect: (id: string) => void;
  onSelectMany: (ids: string[], on: boolean) => void;
  onOpenPage: (id: string) => void;
  onMovePage: (pageId: string, groupId: string, subId: string) => void;
  onOpenModal: (draft: NicheDraft) => void;
}) {
  const [metric, setMetric] = useState<BarMetric>("views");

  return (
    <div className="crm-pop" style={screenPad}>
      {/* Khối 1 — Niche cards */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={cardTitle}>Tổng hợp ngách</div>
        <div style={cardHint}>Cộng dồn từ page đã nhập</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(196px,1fr))",
          gap: 12,
        }}
      >
        {niches.map((n) => (
          <NicheCard
            key={n.id}
            niche={n}
            onEdit={() => onOpenModal({ id: n.id, name: n.name, color: n.color })}
          />
        ))}
        <button
          onClick={() => onOpenModal({ id: null, name: "", color: "#0891b2" })}
          style={{
            border: "1px dashed var(--border-strong)",
            borderRadius: 11,
            background: "transparent",
            color: "var(--accent)",
            cursor: "pointer",
            fontSize: 13.5,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            minHeight: 118,
          }}
        >
          + Tạo ngách mới
        </button>
      </div>

      {/* Khối 2 — So sánh ngách */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 11,
          padding: "16px 18px",
          marginTop: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={cardTitle}>So sánh ngách</div>
          <div
            style={{
              display: "flex",
              border: "1px solid var(--border)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {METRICS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMetric(m.id)}
                style={{
                  padding: "6px 12px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: metric === m.id ? 600 : 500,
                  background: metric === m.id ? "var(--accent)" : "transparent",
                  color: metric === m.id ? "#fff" : "var(--muted)",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ height: 220, marginTop: 14, position: "relative" }}>
          <BarChart niches={niches} metric={metric} theme={theme} />
        </div>
      </div>

      {/* Khối 3 — Bảng cây phân cấp */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 11,
          marginTop: 16,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "15px 18px 12px",
          }}
        >
          <div style={cardTitle}>Phân cấp nhóm page</div>
          <div style={cardHint}>
            Nhóm 25 page → sub-group → page · kéo-thả page để chuyển sub-group
          </div>
        </div>

        <div style={{ padding: "0 18px 12px" }}>
          <ClassifyLegend pages={pages} />
        </div>

        <TreeTable
          groups={groups}
          subs={subs}
          pages={pages}
          niches={niches}
          selected={selected}
          onToggleSelect={onToggleSelect}
          onSelectMany={onSelectMany}
          onOpenPage={onOpenPage}
          onMovePage={onMovePage}
        />
      </div>
    </div>
  );
}
