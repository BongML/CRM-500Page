"use client";

import { select } from "@/lib/ui";
import { int } from "@/lib/format";
import type { AdminUser, Group, Niche, SessionUser } from "@/lib/types";

/**
 * Topbar sticky: tiêu đề + phạm vi dữ liệu (tài khoản tổng) + filter nhóm/ngách
 * + badge nguồn dữ liệu.
 */
export default function Topbar({
  title,
  showFilters,
  groups,
  niches,
  groupFilter,
  nicheFilter,
  onGroupFilter,
  onNicheFilter,
  onImport,
  user,
  accounts,
  scopeUserId,
  onScope,
  onLogout,
}: {
  title: string;
  showFilters: boolean;
  groups: Group[];
  niches: Niche[];
  groupFilter: string;
  nicheFilter: string | null;
  onGroupFilter: (v: string) => void;
  onNicheFilter: (v: string | null) => void;
  onImport: () => void;
  user: SessionUser | null;
  /** Danh sách tài khoản để tài khoản tổng chọn phạm vi. Rỗng với người dùng thường. */
  accounts: AdminUser[];
  /** null = đang xem gộp toàn hệ thống. */
  scopeUserId: string | null;
  onScope: (id: string | null) => void;
  onLogout: () => void;
}) {
  const admin = user?.role === "admin";
  const allPages = accounts.reduce((a, u) => a + u.pages, 0);
  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 20,
        background: "var(--surface)",
        borderBottom: "1px solid var(--border)",
        padding: "0 26px",
        height: 58,
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 600, flex: "none" }}>{title}</div>

      {admin && (
        <div style={{ display: "flex", alignItems: "center", gap: 7, flex: "none" }}>
          <span style={{ fontSize: 11.5, color: "var(--muted)" }}>Dữ liệu:</span>
          <select
            value={scopeUserId ?? "all"}
            onChange={(e) => onScope(e.target.value === "all" ? null : e.target.value)}
            style={{
              ...select,
              maxWidth: 260,
              borderColor: scopeUserId ? "var(--accent)" : "var(--border-strong)",
              color: scopeUserId ? "var(--accent)" : "var(--text)",
              fontWeight: 600,
            }}
            aria-label="Phạm vi dữ liệu"
            title="Xem gộp toàn hệ thống, hoặc bước vào không gian của một tài khoản để nhập / sửa hộ"
          >
            <option value="all">
              Toàn hệ thống{accounts.length ? ` — ${int(allPages)} page` : ""}
            </option>
            {accounts.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} — {int(u.pages)} page
              </option>
            ))}
          </select>
        </div>
      )}

      {showFilters && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: 6 }}>
          <select
            value={groupFilter}
            onChange={(e) => onGroupFilter(e.target.value)}
            style={select}
            aria-label="Lọc theo nhóm page"
          >
            <option value="all">Tất cả nhóm page</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          <select
            value={nicheFilter ?? "all"}
            onChange={(e) => onNicheFilter(e.target.value === "all" ? null : e.target.value)}
            style={select}
            aria-label="Lọc theo ngách"
          >
            <option value="all">Tất cả ngách</option>
            {niches.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        onClick={onImport}
        title="Nhập báo cáo .xlsx export từ Fanpage Karma"
        style={{
          marginLeft: "auto",
          height: 34,
          padding: "0 14px",
          display: "flex",
          alignItems: "center",
          gap: 7,
          border: "1px solid var(--border-strong)",
          borderRadius: 8,
          background: "var(--surface)",
          color: "var(--text)",
          cursor: "pointer",
          fontSize: 12.5,
          fontWeight: 600,
        }}
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>↑</span>
        Nhập .xlsx
      </button>

      {user && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11.5,
            color: "var(--muted)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            padding: "5px 6px 5px 12px",
            maxWidth: 260,
          }}
          title={user.email}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontWeight: 500,
              color: "var(--text)",
            }}
          >
            {user.name || user.email}
          </span>
          {admin && (
            <span
              style={{
                flex: "none",
                fontSize: 10.5,
                fontWeight: 700,
                padding: "2px 7px",
                borderRadius: 20,
                background: "var(--accent-soft)",
                color: "var(--accent)",
              }}
            >
              TỔNG
            </span>
          )}
          <button
            onClick={onLogout}
            style={{
              border: "none",
              borderRadius: 14,
              background: "var(--border)",
              color: "var(--text)",
              padding: "3px 10px",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Thoát
          </button>
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 11.5,
          color: "var(--muted)",
          border: "1px solid var(--border)",
          borderRadius: 20,
          padding: "5px 12px",
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--good)" }} />
        Nguồn: báo cáo Karmar
      </div>
    </div>
  );
}
