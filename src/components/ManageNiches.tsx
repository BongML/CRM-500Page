"use client";

import { useState } from "react";
import { btnGhost, btnMini, btnPrimary, cardHint, cardTitle, select } from "@/lib/ui";
import { tint } from "@/lib/format";
import type { Niche, Page } from "@/lib/types";
import type { NicheDraft } from "./NicheModal";

/** CRUD ngách: tạo / sửa (mở modal ngách) / xóa kèm chuyển page sang ngách khác. */
export default function ManageNiches({
  niches,
  pages,
  onOpenModal,
  onDelete,
}: {
  niches: Niche[];
  pages: Page[];
  onOpenModal: (draft: NicheDraft) => void;
  onDelete: (id: string, moveTo: string | null) => void;
}) {
  const [deleting, setDeleting] = useState<{ id: string; moveTo: string } | null>(null);

  // Page mang nhiều ngách nên được đếm ở mọi ngách nó thuộc về.
  const countOf = (id: string) => pages.filter((p) => p.nicheIds.includes(id)).length;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 11,
        padding: "16px 18px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={cardTitle}>Ngách (thẻ phân loại page)</div>
        <div style={cardHint}>
          Một page gán được nhiều ngách · xóa ngách thì page trong ngách được chuyển sang ngách khác
        </div>
      </div>

      <div>
        <button onClick={() => onOpenModal({ id: null, name: "", color: "#0891b2" })} style={btnPrimary}>
          + Tạo ngách mới
        </button>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: 9 }}>
        {niches.map((n) => {
          const count = countOf(n.id);
          const isDeleting = deleting?.id === n.id;
          const targets = niches.filter((x) => x.id !== n.id);

          return (
            <div key={n.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px" }}>
                <span
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    background: tint(n.color),
                    color: n.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 12.5,
                  }}
                >
                  {n.icon}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{n.name}</span>
                <span style={{ fontSize: 11.5, color: "var(--muted)" }}>{count} page</span>

                <div style={{ marginLeft: "auto", display: "flex", gap: 7 }}>
                  <button
                    onClick={() => onOpenModal({ id: n.id, name: n.name, color: n.color })}
                    style={btnMini}
                  >
                    Sửa
                  </button>
                  <button
                    onClick={() =>
                      setDeleting(
                        isDeleting ? null : { id: n.id, moveTo: targets[0]?.id ?? "" },
                      )
                    }
                    disabled={niches.length <= 1}
                    title={niches.length <= 1 ? "Phải còn ít nhất 1 ngách" : "Xóa ngách"}
                    style={{
                      ...btnMini,
                      color: niches.length <= 1 ? "var(--faint)" : "var(--danger)",
                      cursor: niches.length <= 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    Xóa
                  </button>
                </div>
              </div>

              {isDeleting && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                    padding: "10px 12px",
                    background: "var(--danger-soft)",
                  }}
                >
                  <span style={{ fontSize: 12.5, color: "var(--danger)", fontWeight: 500 }}>
                    {count > 0
                      ? `Xóa "${n.name}" và chuyển ${count} page sang:`
                      : `Xóa ngách "${n.name}"?`}
                  </span>

                  {count > 0 && (
                    <select
                      value={deleting.moveTo}
                      onChange={(e) => setDeleting({ ...deleting, moveTo: e.target.value })}
                      style={select}
                    >
                      {targets.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    onClick={() => {
                      onDelete(n.id, count > 0 ? deleting.moveTo : null);
                      setDeleting(null);
                    }}
                    disabled={count > 0 && !deleting.moveTo}
                    style={{
                      ...btnPrimary,
                      height: 32,
                      fontSize: 12.5,
                      background: "var(--danger)",
                      opacity: count > 0 && !deleting.moveTo ? 0.55 : 1,
                    }}
                  >
                    Xác nhận xóa
                  </button>
                  <button
                    onClick={() => setDeleting(null)}
                    style={{ ...btnGhost, height: 32, fontSize: 12.5 }}
                  >
                    Hủy
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
