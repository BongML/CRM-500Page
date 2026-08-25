"use client";

import { useState } from "react";
import type { Niche } from "@/lib/types";
import { NicheDot } from "./Atoms";

/**
 * Thanh bulk nổi giữa dưới màn khi có page được tick.
 *
 * Bấm một ngách là **thêm** ngách đó cho mọi page đã chọn — page giữ nhiều ngách
 * nên các ngách sẵn có không bị thay mất. Muốn thay trọn hoặc gỡ bớt thì dùng
 * bảng "Gán page vào nhóm & ngách" ở màn Quản lý.
 */
export default function BulkBar({
  count,
  niches,
  onAdd,
  onDelete,
  onClear,
}: {
  count: number;
  niches: Niche[];
  onAdd: (nicheId: string) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  /** Xóa không hoàn tác được — lần bấm đầu chỉ đổi nút sang trạng thái hỏi lại. */
  const [ask, setAsk] = useState(false);

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
      <span style={{ fontSize: 12, opacity: 0.7 }} title="Ngách được thêm vào, không thay ngách sẵn có">
        Thêm ngách:
      </span>
      <div style={{ display: "flex", gap: 7 }}>
        {niches.map((n) => (
          <button
            key={n.id}
            onClick={() => onAdd(n.id)}
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
        onClick={() => {
          if (!ask) {
            setAsk(true);
            window.setTimeout(() => setAsk(false), 5000);
            return;
          }
          setAsk(false);
          onDelete();
        }}
        title="Xóa hẳn các page đã chọn khỏi hệ thống, kèm top content của chúng"
        style={{
          border: `1px solid ${ask ? "transparent" : "rgba(255,255,255,.2)"}`,
          borderRadius: 7,
          background: ask ? "var(--danger)" : "transparent",
          color: ask ? "#fff" : "inherit",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: ask ? 600 : 400,
          padding: "6px 10px",
          whiteSpace: "nowrap",
        }}
      >
        {ask ? `Bấm lần nữa để xóa ${count} page` : "Xóa"}
      </button>

      <button
        onClick={() => {
          setAsk(false);
          onClear();
        }}
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
