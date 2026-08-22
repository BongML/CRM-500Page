"use client";

import { useState } from "react";
import { btnGhost, btnMini, btnPrimary, cardHint, cardTitle, input, inputMini, tnum } from "@/lib/ui";
import { int } from "@/lib/format";
import type { AdminUser } from "@/lib/types";

const ADMIN_ROLE = "admin";

const th = {
  padding: "9px 10px",
  fontWeight: 600,
  color: "var(--muted)",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap" as const,
};

const td = { padding: "9px 10px", borderBottom: "1px solid var(--border)" };

/**
 * Quản lý người dùng — chỉ tài khoản tổng thấy tab này.
 *
 * Mỗi dòng là một không gian dữ liệu độc lập; cột "Page" cho biết ai đang giữ
 * bao nhiêu fanpage, và nút "Mở dữ liệu" chuyển hẳn phiên làm việc sang tài
 * khoản đó để nhập báo cáo / tạo nhóm hộ họ.
 */
export default function ManageUsers({
  users,
  me,
  scopeUserId,
  defaultPassword,
  onCreate,
  onUpdate,
  onDelete,
  onOpenScope,
}: {
  users: AdminUser[];
  me: string | null;
  scopeUserId: string | null;
  defaultPassword: boolean;
  onCreate: (v: { email: string; password: string; name: string; role: string }) => void;
  onUpdate: (id: string, v: { name?: string; password?: string; role?: string }) => void;
  onDelete: (id: string) => void;
  onOpenScope: (id: string | null) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [asAdmin, setAsAdmin] = useState(false);

  const [resetting, setResetting] = useState<{ id: string; value: string } | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const totalPages = users.reduce((a, u) => a + u.pages, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {defaultPassword && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: 9,
            background: "var(--danger-soft)",
            color: "var(--danger)",
            fontSize: 12.5,
            lineHeight: 1.55,
          }}
        >
          Tài khoản tổng đang dùng <b>mật khẩu mặc định</b>. Hãy đặt lại mật khẩu ở dòng của chính
          bạn bên dưới (hoặc đặt biến môi trường <code>CRM_ADMIN_PASSWORD</code>) trước khi chia sẻ
          đường dẫn cho người khác.
        </div>
      )}

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
          <div style={cardTitle}>Người dùng ({users.length})</div>
          <div style={cardHint}>Tổng cộng {int(totalPages)} page trên toàn hệ thống</div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Tài khoản</th>
                <th style={{ ...th, textAlign: "left" }}>Quyền</th>
                <th style={{ ...th, textAlign: "right" }}>Page</th>
                <th style={{ ...th, textAlign: "right" }}>Ngách</th>
                <th style={{ ...th, textAlign: "right" }}>Nhóm</th>
                <th style={{ ...th, textAlign: "right" }}>Bài</th>
                <th style={{ ...th, textAlign: "right" }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = u.id === me;
                const isAdmin = u.role === ADMIN_ROLE;
                const viewing = scopeUserId === u.id;

                return (
                  <tr key={u.id} style={viewing ? { background: "var(--accent-soft)" } : undefined}>
                    <td style={{ ...td, minWidth: 220 }}>
                      {renaming?.id === u.id ? (
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            autoFocus
                            value={renaming.value}
                            onChange={(e) => setRenaming({ id: u.id, value: e.target.value })}
                            style={{ ...inputMini, flex: 1 }}
                          />
                          <button
                            style={btnMini}
                            onClick={() => {
                              onUpdate(u.id, { name: renaming.value.trim() });
                              setRenaming(null);
                            }}
                          >
                            Lưu
                          </button>
                          <button style={btnMini} onClick={() => setRenaming(null)}>
                            Hủy
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ fontWeight: 600 }}>
                            {u.name}
                            {isMe && (
                              <span style={{ marginLeft: 7, fontSize: 11, color: "var(--muted)" }}>
                                (bạn)
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--muted)" }}>{u.email}</div>
                        </>
                      )}
                    </td>

                    <td style={td}>
                      <span
                        style={{
                          fontSize: 11.5,
                          fontWeight: 600,
                          padding: "3px 9px",
                          borderRadius: 20,
                          background: isAdmin ? "var(--accent-soft)" : "var(--border)",
                          color: isAdmin ? "var(--accent)" : "var(--muted)",
                        }}
                      >
                        {isAdmin ? "Tài khoản tổng" : "Người dùng"}
                      </span>
                    </td>

                    <td style={{ ...td, ...tnum, textAlign: "right", fontWeight: 600 }}>
                      {int(u.pages)}
                    </td>
                    <td style={{ ...td, ...tnum, textAlign: "right" }}>{int(u.niches)}</td>
                    <td style={{ ...td, ...tnum, textAlign: "right" }}>{int(u.groups)}</td>
                    <td style={{ ...td, ...tnum, textAlign: "right" }}>{int(u.posts)}</td>

                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          justifyContent: "flex-end",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          style={btnMini}
                          title="Chuyển phiên làm việc vào không gian dữ liệu của tài khoản này"
                          onClick={() => onOpenScope(viewing ? null : u.id)}
                        >
                          {viewing ? "Về toàn hệ thống" : "Mở dữ liệu"}
                        </button>
                        <button
                          style={btnMini}
                          onClick={() => setRenaming({ id: u.id, value: u.name })}
                        >
                          Đổi tên
                        </button>
                        <button style={btnMini} onClick={() => setResetting({ id: u.id, value: "" })}>
                          Đặt lại mật khẩu
                        </button>
                        {!isMe && (
                          <button
                            style={btnMini}
                            onClick={() => onUpdate(u.id, { role: isAdmin ? "user" : ADMIN_ROLE })}
                          >
                            {isAdmin ? "Bỏ quyền tổng" : "Cấp quyền tổng"}
                          </button>
                        )}
                        {!isMe && (
                          <button
                            style={{
                              ...btnMini,
                              color: "var(--danger)",
                              borderColor:
                                confirmDelete === u.id ? "var(--danger)" : "var(--border)",
                            }}
                            onClick={() => {
                              if (confirmDelete === u.id) {
                                onDelete(u.id);
                                setConfirmDelete(null);
                              } else {
                                setConfirmDelete(u.id);
                                window.setTimeout(
                                  () => setConfirmDelete((c) => (c === u.id ? null : c)),
                                  5000,
                                );
                              }
                            }}
                          >
                            {confirmDelete === u.id ? `Xóa cả ${int(u.pages)} page?` : "Xóa"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {resetting && (
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              padding: "10px 12px",
              border: "1px solid var(--border-strong)",
              borderRadius: 9,
            }}
          >
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
              Mật khẩu mới cho {users.find((u) => u.id === resetting.id)?.email}:
            </span>
            <input
              autoFocus
              type="text"
              value={resetting.value}
              placeholder="tối thiểu 8 ký tự"
              onChange={(e) => setResetting({ id: resetting.id, value: e.target.value })}
              style={{ ...inputMini, width: 220 }}
            />
            <button
              style={btnMini}
              onClick={() => {
                onUpdate(resetting.id, { password: resetting.value });
                setResetting(null);
              }}
            >
              Đặt lại
            </button>
            <button style={btnMini} onClick={() => setResetting(null)}>
              Hủy
            </button>
          </div>
        )}
      </div>

      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 11,
          padding: "16px 18px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={cardTitle}>Tạo tài khoản mới</div>
        <div style={cardHint}>
          Tài khoản mới bắt đầu với không gian dữ liệu rỗng. Bạn vẫn xem và nhập hộ được qua nút
          &ldquo;Mở dữ liệu&rdquo;.
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@congty.vn"
            style={{ ...input, minWidth: 220 }}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên hiển thị (không bắt buộc)"
            style={{ ...input, minWidth: 200 }}
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mật khẩu (từ 8 ký tự)"
            style={{ ...input, minWidth: 180 }}
          />
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 12.5,
              color: "var(--muted)",
            }}
          >
            <input
              type="checkbox"
              checked={asAdmin}
              onChange={(e) => setAsAdmin(e.target.checked)}
            />
            Cấp quyền tài khoản tổng
          </label>
          <button
            style={btnPrimary}
            onClick={() => {
              onCreate({ email, password, name, role: asAdmin ? ADMIN_ROLE : "user" });
              setEmail("");
              setName("");
              setPassword("");
              setAsAdmin(false);
            }}
          >
            + Tạo tài khoản
          </button>
          <button
            style={btnGhost}
            onClick={() => {
              setEmail("");
              setName("");
              setPassword("");
              setAsAdmin(false);
            }}
          >
            Xóa form
          </button>
        </div>
      </div>
    </div>
  );
}
