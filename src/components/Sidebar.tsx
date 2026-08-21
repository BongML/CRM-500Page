"use client";

import type { Screen } from "@/lib/types";
import type { Theme } from "@/lib/theme";

const NAV: { id: Screen; label: string; glyph: string }[] = [
  { id: "dashboard", label: "Dashboard", glyph: "▦" },
  { id: "catalog", label: "Danh mục ngách & nhóm", glyph: "▤" },
  { id: "manage", label: "Quản lý dữ liệu", glyph: "⚙" },
];

export default function Sidebar({
  screen,
  theme,
  onNavigate,
  onToggleTheme,
}: {
  screen: Screen;
  theme: Theme;
  onNavigate: (s: Screen) => void;
  onToggleTheme: () => void;
}) {
  return (
    <aside
      style={{
        width: 236,
        flex: "none",
        borderRight: "1px solid var(--border)",
        background: "var(--surface)",
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
      }}
    >
      <div
        style={{
          padding: "20px 18px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: "var(--accent)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          F
        </div>
        <div style={{ fontWeight: 600, fontSize: 14.5 }}>Fanpage CRM</div>
      </div>

      <nav style={{ padding: "12px 10px", display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
        {NAV.map((item) => {
          // Trang chi tiết page là drill-down của danh mục nên vẫn sáng mục catalog.
          const active = screen === item.id || (item.id === "catalog" && screen === "page");
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "9px 12px",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13.5,
                textAlign: "left",
                fontWeight: active ? 600 : 500,
                color: active ? "var(--accent)" : "var(--text)",
                background: active ? "var(--accent-soft)" : "transparent",
              }}
            >
              <span style={{ width: 18, textAlign: "center" }}>{item.glyph}</span>
              <span>{item.label}</span>
            </button>
          );
        })}

        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            border: "1px dashed var(--border-strong)",
            borderRadius: 8,
            fontSize: 11.5,
            color: "var(--muted)",
            lineHeight: 1.5,
          }}
        >
          Số liệu lấy nguyên theo <b style={{ color: "var(--text)" }}>kỳ của báo cáo</b> đã nhập từ
          Karmar. Không có bộ lọc thời gian riêng.
        </div>
      </nav>

      <div
        style={{
          padding: "12px 10px",
          borderTop: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button
          onClick={onToggleTheme}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            padding: "8px 12px",
            border: "1px solid var(--border)",
            borderRadius: 8,
            background: "transparent",
            color: "var(--text)",
            cursor: "pointer",
            fontSize: 13,
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>{theme === "dark" ? "☀" : "☾"}</span>
            {theme === "dark" ? "Chế độ sáng" : "Chế độ tối"}
          </span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {theme === "dark" ? "Dark" : "Light"}
          </span>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 6px 2px" }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "var(--accent-soft)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            AD
          </div>
          <div style={{ lineHeight: 1.25 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>Admin</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>admin@crm.vn</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
