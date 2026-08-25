"use client";

import { useEffect, useRef, useState } from "react";
import { tint } from "@/lib/format";
import type { Niche } from "@/lib/types";
import { NicheDot } from "./Atoms";

/**
 * Ô chọn **nhiều ngách** cho một page — thay cho dropdown một-chọn-một cũ.
 *
 * Thay đổi được gom lại rồi mới gửi đi **một lần lúc đóng bảng**: tick 3 ngách
 * mà bắn 3 lượt PATCH thì vừa tốn vòng mạng vừa dễ tạo trạng thái nửa vời nếu
 * một lượt hỏng. Bảng chọn đóng khi bấm ra ngoài hoặc nhấn Esc.
 */
export default function NichePicker({
  niches,
  value,
  onChange,
  placeholder = "Chưa gán ngách",
  width = "100%",
  align = "left",
}: {
  niches: Niche[];
  /** Tập ngách hiện tại của page (thứ tự có ý nghĩa: phần tử đầu là ngách chính). */
  value: string[];
  /** Gọi khi bảng đóng và tập ngách thực sự đổi. Nhận **toàn bộ** tập mới. */
  onChange: (nicheIds: string[]) => void;
  placeholder?: string;
  width?: number | string;
  /** Bảng chọn bung sang phải hay canh mép phải của nút (dùng ở cột sát lề). */
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);
  const box = useRef<HTMLDivElement>(null);
  /** Bản nháp mới nhất — dùng lúc đóng, tránh đọc phải state cũ trong listener. */
  const latest = useRef(draft);
  latest.current = draft;

  // Tập ngách đổi từ bên ngoài (nhập báo cáo, gán hàng loạt) khi bảng đang đóng.
  useEffect(() => {
    if (!open) setDraft(value);
  }, [value, open]);

  useEffect(() => {
    if (!open) return;

    const commit = () => {
      setOpen(false);
      const next = latest.current;
      const same = next.length === value.length && next.every((id, i) => id === value[i]);
      if (!same) onChange(next);
    };

    const onDown = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) commit();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") commit();
    };

    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, value, onChange]);

  const picked = draft
    .map((id) => niches.find((n) => n.id === id))
    .filter((n): n is Niche => !!n);
  const head = picked[0];

  return (
    <div ref={box} style={{ position: "relative", width }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={picked.length ? picked.map((n) => n.name).join(", ") : placeholder}
        style={{
          width: "100%",
          height: 32,
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 8px",
          border: "1px solid var(--border-strong)",
          borderRadius: 8,
          background: head ? tint(head.color) : "var(--surface)",
          color: head?.color ?? "var(--muted)",
          fontSize: 12.5,
          fontWeight: head ? 600 : 400,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        {head && <NicheDot color={head.color} size={7} />}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {head?.name ?? placeholder}
        </span>
        {picked.length > 1 && (
          <span style={{ flex: "none", fontSize: 11, opacity: 0.85 }}>+{picked.length - 1}</span>
        )}
        <span style={{ flex: "none", fontSize: 9, color: "var(--muted)" }}>▾</span>
      </button>

      {open && (
        <div
          className="crm-scroll crm-pop-fast"
          style={{
            position: "absolute",
            zIndex: 40,
            top: 35,
            left: align === "left" ? 0 : undefined,
            right: align === "right" ? 0 : undefined,
            minWidth: 210,
            maxWidth: 280,
            maxHeight: 260,
            overflow: "auto",
            background: "var(--surface)",
            border: "1px solid var(--border-strong)",
            borderRadius: 9,
            boxShadow: "0 14px 34px rgba(15,18,25,.22)",
          }}
        >
          {niches.map((n) => {
            const on = draft.includes(n.id);
            return (
              <label
                key={n.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 10px",
                  borderBottom: "1px solid var(--border)",
                  fontSize: 12.5,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                <input
                  type="checkbox"
                  checked={on}
                  // Bỏ tick thì gỡ khỏi mảng; tick thì nối vào cuối, nên ngách
                  // chính chỉ đổi khi người dùng bỏ chính nó ra.
                  onChange={() =>
                    setDraft((cur) => (on ? cur.filter((x) => x !== n.id) : [...cur, n.id]))
                  }
                  style={{ width: 14, height: 14, accentColor: "var(--accent)" }}
                />
                <NicheDot color={n.color} size={7} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{n.name}</span>
              </label>
            );
          })}

          {niches.length === 0 && (
            <div style={{ padding: "9px 11px", fontSize: 12, color: "var(--muted)" }}>
              Chưa có ngách nào.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
