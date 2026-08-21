"use client";

import { useState } from "react";
import { input, label } from "@/lib/ui";
import type { SessionUser } from "@/lib/types";

type Mode = "login" | "register";

/**
 * Màn đăng nhập / tự đăng ký. Mỗi tài khoản là một không gian dữ liệu riêng:
 * ngách, nhóm và page của người này người kia không thấy được.
 */
export default function LoginScreen({ onDone }: { onDone: (user: SessionUser) => void }) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const register = mode === "register";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(register ? "/api/register" : "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(register ? { email, password, name } : { email, password }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        user?: SessionUser;
      };
      if (!res.ok || !body.user) {
        setError(body.error ?? (register ? "Đăng ký thất bại." : "Đăng nhập thất bại."));
        return;
      }
      onDone(body.user);
    } catch {
      setError("Không kết nối được máy chủ.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg)",
        padding: 24,
      }}
    >
      <form
        onSubmit={submit}
        style={{
          width: 340,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 32,
          boxShadow: "0 1px 2px rgba(16,24,40,.04)",
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          {(["login", "register"] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                style={{
                  flex: 1,
                  height: 34,
                  border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                  borderRadius: 8,
                  background: active ? "var(--accent)" : "transparent",
                  color: active ? "#fff" : "var(--text)",
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  cursor: "pointer",
                }}
              >
                {m === "login" ? "Đăng nhập" : "Đăng ký"}
              </button>
            );
          })}
        </div>

        {register && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={label}>Tên hiển thị</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="để trống thì lấy theo email"
              autoComplete="name"
              style={input}
            />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
            style={input}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={label}>Mật khẩu</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={register ? "new-password" : "current-password"}
            required
            minLength={register ? 8 : undefined}
            style={input}
          />
          {register && (
            <span style={{ fontSize: 11.5, color: "var(--faint)" }}>Tối thiểu 8 ký tự.</span>
          )}
        </div>

        {error && <div style={{ fontSize: 12.5, color: "var(--danger)" }}>{error}</div>}

        <button
          type="submit"
          disabled={busy}
          style={{
            height: 40,
            marginTop: 4,
            border: "none",
            borderRadius: 8,
            background: "var(--accent)",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: busy ? "default" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Đang xử lý…" : register ? "Tạo tài khoản" : "Đăng nhập"}
        </button>

        <div style={{ fontSize: 11.5, color: "var(--faint)", lineHeight: 1.6 }}>
          {register
            ? "Tài khoản mới bắt đầu với dữ liệu rỗng — nhập báo cáo Karmar của bạn để có số liệu."
            : "Dữ liệu của mỗi tài khoản tách biệt hoàn toàn."}
        </div>
      </form>
    </div>
  );
}
