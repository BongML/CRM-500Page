"use client";

import { useMemo, useState } from "react";
import { SWATCH_COLORS, nichesOf, tint } from "@/lib/format";
import { label } from "@/lib/ui";
import type { Niche, Page } from "@/lib/types";
import { Avatar } from "./Atoms";

export type NicheDraft = { id: string | null; name: string; color: string };

/**
 * Modal tạo/chỉnh ngách: tên + màu + multi-select page có search.
 *
 * Danh sách tick là **thành viên đầy đủ** của ngách: bỏ tick một page là gỡ page
 * khỏi ngách này, các ngách khác của page không bị đụng tới.
 */
export default function NicheModal({
  draft,
  pages,
  niches,
  onClose,
  onSave,
}: {
  draft: NicheDraft;
  pages: Page[];
  niches: Niche[];
  onClose: () => void;
  onSave: (v: { id: string | null; name: string; color: string; pageIds: string[] }) => void;
}) {
  const [name, setName] = useState(draft.name);
  const [color, setColor] = useState(draft.color);
  const [search, setSearch] = useState("");
  // Chỉnh ngách: các page đang thuộc ngách được tick sẵn.
  const [picked, setPicked] = useState<Record<string, boolean>>(() =>
    draft.id
      ? Object.fromEntries(
          pages.filter((p) => p.nicheIds.includes(draft.id!)).map((p) => [p.id, true]),
        )
      : {},
  );
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? pages.filter((p) => p.name.toLowerCase().includes(term)) : pages;
  }, [pages, search]);

  const selectedCount = Object.values(picked).filter(Boolean).length;
  const icon = (name.trim()[0] || "N").toUpperCase();

  function save() {
    setBusy(true);
    onSave({
      id: draft.id,
      name,
      color,
      pageIds: Object.keys(picked).filter((k) => picked[k]),
    });
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(15,18,25,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="crm-pop-fast"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 520,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(15,18,25,.28)",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600 }}>
            {draft.id ? "Chỉnh ngách" : "Tạo ngách mới"}
          </div>
          <button
            onClick={onClose}
            aria-label="Đóng"
            style={{
              border: "none",
              background: "transparent",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: 20,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        <div
          className="crm-scroll"
          style={{
            padding: "18px 20px",
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "flex-end" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={label}>Tên ngách</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Review sản phẩm"
                style={{
                  height: 38,
                  padding: "0 12px",
                  border: "1px solid var(--border-strong)",
                  borderRadius: 8,
                  background: "var(--surface)",
                  color: "var(--text)",
                  fontSize: 14,
                }}
              />
            </div>
            <div
              style={{
                width: 44,
                height: 38,
                borderRadius: 8,
                background: tint(color),
                color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 17,
              }}
            >
              {icon}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={label}>Màu</label>
            <div style={{ display: "flex", gap: 10 }}>
              {SWATCH_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`Chọn màu ${c}`}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    cursor: "pointer",
                    background: c,
                    border: color === c ? "3px solid var(--text)" : "2px solid transparent",
                    outline: "1px solid var(--border)",
                  }}
                />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={label}>Gán vào page ({selectedCount} đã chọn)</label>
            <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: -3 }}>
              Page giữ nguyên các ngách khác — bỏ tick chỉ gỡ page khỏi ngách này.
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm page…"
              style={{
                height: 34,
                padding: "0 12px",
                border: "1px solid var(--border-strong)",
                borderRadius: 8,
                background: "var(--surface)",
                color: "var(--text)",
                fontSize: 13,
              }}
            />
            <div
              className="crm-scroll"
              style={{
                maxHeight: 210,
                overflow: "auto",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            >
              {list.map((p) => (
                <label
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 12px",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!picked[p.id]}
                    onChange={() => setPicked((s) => ({ ...s, [p.id]: !s[p.id] }))}
                    style={{ width: 15, height: 15, accentColor: "var(--accent)" }}
                  />
                  <Avatar name={p.name} src={p.image} size={22} radius={5} fontSize={9} />
                  {p.name}
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 11,
                      color: "var(--faint)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: 150,
                    }}
                    title={nichesOf(niches, p.nicheIds).map((n) => n.name).join(", ")}
                  >
                    {nichesOf(niches, p.nicheIds).map((n) => n.name).join(", ") || "Chưa gán ngách"}
                  </span>
                </label>
              ))}
              {list.length === 0 && (
                <div style={{ padding: "10px 12px", fontSize: 12.5, color: "var(--muted)" }}>
                  Không tìm thấy page nào.
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: 38,
              padding: "0 16px",
              border: "1px solid var(--border-strong)",
              borderRadius: 8,
              background: "transparent",
              color: "var(--text)",
              cursor: "pointer",
              fontSize: 13.5,
              fontWeight: 500,
            }}
          >
            Hủy
          </button>
          <button
            onClick={save}
            disabled={busy}
            style={{
              height: 38,
              padding: "0 18px",
              border: "none",
              borderRadius: 8,
              background: "var(--accent)",
              color: "#fff",
              cursor: busy ? "default" : "pointer",
              fontSize: 13.5,
              fontWeight: 600,
              opacity: busy ? 0.7 : 1,
            }}
          >
            Lưu ngách
          </button>
        </div>
      </div>
    </div>
  );
}
