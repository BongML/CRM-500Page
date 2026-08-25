import type { CSSProperties } from "react";
import type { Niche } from "./types";

/** Rút gọn views: ≥1tr → "18,4 tr", ≥1K → "90K". */
export function vShort(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + " tr";
  if (n >= 1e3) return Math.round(n / 1e3) + "K";
  return String(n);
}

/** Số nguyên định dạng VN (dấu . ngăn nghìn). */
export function int(n: number): string {
  return n.toLocaleString("vi-VN");
}

/** Số lẻ 1 chữ số kiểu VN: 2.357 → "2,4". */
export function dec1(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

/** Phần trăm với dấu phẩy: "4,9%". */
export function pct(n: number): string {
  return String(n).replace(".", ",") + "%";
}

/** Nền tag = màu ngách + alpha ~11%. */
export function tint(hex: string): string {
  return hex + "1c";
}

export type Status = { label: string; color: string; soft: string };

/** Trạng thái theo PPI: ≥80 Hiệu quả · 60–79 Trung bình · <60 Cần review. */
export function statusOf(ppi: number): Status {
  if (ppi >= 80) return { label: "Hiệu quả", color: "var(--good)", soft: "rgba(22,163,74,.13)" };
  if (ppi >= 60) return { label: "Trung bình", color: "var(--warn)", soft: "rgba(217,119,6,.14)" };
  return { label: "Cần review", color: "var(--danger)", soft: "rgba(220,38,38,.13)" };
}

export function statusStyle(ppi: number): CSSProperties {
  const s = statusOf(ppi);
  return {
    display: "inline-block",
    padding: "3px 9px",
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    color: s.color,
    background: s.soft,
  };
}

/** Style ô Neg. sentiment — đỏ đậm nền danger-soft khi vượt ngưỡng. */
export function negStyle(v: number, threshold: number, strong: boolean): CSSProperties {
  const bad = v > threshold;
  return {
    display: "inline-block",
    padding: strong ? "2px 8px" : "2px 7px",
    borderRadius: 6,
    fontVariantNumeric: "tabular-nums",
    fontWeight: bad ? 700 : 500,
    color: bad ? "var(--danger)" : "var(--muted)",
    background: bad ? "var(--danger-soft)" : "transparent",
  };
}

/** Màu avatar/thumbnail sinh từ tên (HSL). */
export function avatarBg(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 360;
  return `hsl(${h} 52% 52%)`;
}

/** Chữ cái đầu (2 từ đầu). */
export function initials(str: string): string {
  const w = str.split(" ").filter(Boolean);
  return ((w[0]?.[0] || "") + (w[1]?.[0] || "")).toUpperCase();
}

/** Ngách giữ chỗ khi bản ghi trỏ tới ngách đã xóa, hoặc khi hệ thống còn rỗng. */
const UNKNOWN_NICHE: Niche = {
  id: "",
  name: "Chưa phân loại",
  color: "#64748b",
  icon: "?",
  aggPages: 0,
  aggViews: 0,
  aggReach: 0,
  aggRate: 0,
  aggPpi: 0,
  order: 0,
};

export function nicheById(niches: Niche[], id: string): Niche {
  return niches.find((n) => n.id === id) ?? UNKNOWN_NICHE;
}

/**
 * Các ngách của một page, theo đúng thứ tự đã gán. Id trỏ tới ngách đã bị xóa
 * bị bỏ qua thay vì hiện thành ô trống, nên mảng trả về có thể ngắn hơn đầu vào.
 */
export function nichesOf(niches: Niche[], ids: readonly string[]): Niche[] {
  return ids.map((id) => niches.find((n) => n.id === id)).filter((n): n is Niche => !!n);
}

/**
 * Ngách chính của page — dùng ở những chỗ chỉ hiển thị được một nhãn (cây phân
 * cấp, bảng gợi ý…). Page chưa gán ngách nào rơi về nhãn "Chưa phân loại".
 */
export function mainNiche(niches: Niche[], ids: readonly string[]): Niche {
  return nichesOf(niches, ids)[0] ?? UNKNOWN_NICHE;
}

/** Bảng màu chọn khi tạo ngách. */
export const SWATCH_COLORS = [
  "#2563eb", "#7c3aed", "#ea580c", "#16a34a",
  "#d97706", "#0891b2", "#db2777", "#65a30d",
];

/**
 * Link công khai của fanpage để bấm mở tab mới.
 *
 * Ưu tiên cột "External links" của báo cáo benchmark (đôi khi thiếu giao thức
 * nên phải thêm https://). Không có link thì dựng từ Profile-ID, nhưng chỉ khi
 * đó là ID số thật của Facebook — page thiếu Profile-ID được gán mã nội bộ
 * dạng "fp…" (xem pageFallbackId) nên không mở được.
 */
export function pageHref(page: { url: string | null; ref?: string }): string | null {
  const raw = page.url?.trim();
  if (raw) return /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;

  const ref = page.ref?.trim();
  return ref && /^\d{5,}$/.test(ref) ? `https://www.facebook.com/${ref}` : null;
}
