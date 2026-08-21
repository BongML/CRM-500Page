import type { CSSProperties } from "react";

/** Card chuẩn: surface + hairline border + radius 11 + shadow rất nhẹ. */
export const card: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 11,
  boxShadow: "0 1px 2px rgba(16,24,40,.04)",
};

/** Padding nội dung của mỗi màn. */
export const screenPad: CSSProperties = { padding: "22px 26px 40px" };

/** Grid cột cố định của bảng cây phân cấp. */
export const treeCols =
  "34px minmax(210px,2fr) 140px 78px 92px 44px 74px 108px 104px 116px";

export const tnum: CSSProperties = { fontVariantNumeric: "tabular-nums" };

export const cardTitle: CSSProperties = { fontSize: 14, fontWeight: 600 };

export const cardHint: CSSProperties = { fontSize: 11.5, color: "var(--faint)" };

export const label: CSSProperties = {
  fontSize: 12.5,
  fontWeight: 500,
  color: "var(--muted)",
};

export const input: CSSProperties = {
  height: 40,
  padding: "0 12px",
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 14,
};

export const select: CSSProperties = {
  height: 32,
  padding: "0 26px 0 10px",
  border: "1px solid var(--border-strong)",
  borderRadius: 7,
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 12.5,
  cursor: "pointer",
};

export const thBase: CSSProperties = {
  padding: "9px 10px",
  fontWeight: 600,
  color: "var(--muted)",
  borderBottom: "1px solid var(--border)",
  textAlign: "right",
  whiteSpace: "nowrap",
};

export const caret = (open: boolean, color: string, size: number): CSSProperties => ({
  display: "inline-block",
  transition: "transform .15s",
  transform: `rotate(${open ? 90 : 0}deg)`,
  color,
  fontSize: size,
});

/** Nút chính (accent) — dùng ở form quản lý & modal. */
export const btnPrimary: CSSProperties = {
  height: 38,
  padding: "0 18px",
  border: "none",
  borderRadius: 8,
  background: "var(--accent)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 13.5,
  fontWeight: 600,
};

/** Nút phụ viền mảnh. */
export const btnGhost: CSSProperties = {
  height: 38,
  padding: "0 16px",
  border: "1px solid var(--border-strong)",
  borderRadius: 8,
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
  fontSize: 13.5,
  fontWeight: 500,
};

/** Nút nhỏ trong hàng bảng (đổi tên / xóa / thêm sub). */
export const btnMini: CSSProperties = {
  height: 28,
  padding: "0 10px",
  border: "1px solid var(--border)",
  borderRadius: 7,
  background: "transparent",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 500,
};

/** Ô nhập trong bảng/inline. */
export const inputMini: CSSProperties = {
  height: 30,
  padding: "0 10px",
  border: "1px solid var(--border-strong)",
  borderRadius: 7,
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
};
