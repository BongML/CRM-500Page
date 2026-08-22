/**
 * Hai cách xếp loại page, cả hai đều dùng **mốc tuyệt đối** — hạng của một page
 * chỉ đổi khi chính số liệu của nó đổi, không nhảy vì hệ thống vừa nhập thêm
 * page khác. Ngưỡng nằm gọn trong hai bảng dưới đây, sửa ở đây là toàn app đổi
 * theo; không chỗ nào khác hardcode con số.
 *
 *  1. ĐỘ HOT (⚡ 5 → 1) — theo tổng views của page. Dùng để soi page nào đang đuối về
 *     lượt tiếp cận mà dồn lực đẩy.
 *  2. HẠNG FOLLOWER (S → F) — theo số follower, tức quy mô thật của page.
 *
 * Cả hai tính thẳng từ dữ liệu báo cáo đã nhập, không lưu xuống DB.
 */

// ---- 1. Độ hot theo tổng views ----

export type HotLevel = 1 | 2 | 3 | 4 | 5;

/**
 * Mốc tổng views của từng bậc. `min` là sàn của bậc, so bằng `>=` nên page đúng
 * 100.000 views vẫn là 5⚡ chứ không bị tụt bậc.
 */
const HOT_BANDS: { level: HotLevel; min: number; label: string; note: string }[] = [
  { level: 5, min: 100_000, label: "Rất hot", note: "Từ 100K views" },
  { level: 4, min: 50_000, label: "Hot", note: "50K – 100K" },
  { level: 3, min: 20_000, label: "Khá", note: "20K – 50K" },
  { level: 2, min: 5_000, label: "Yếu", note: "5K – 20K" },
  { level: 1, min: 0, label: "Rất yếu", note: "Dưới 5K — cần đẩy tiếp cận" },
];

export function hotLevel(views: number): HotLevel {
  return (HOT_BANDS.find((b) => views >= b.min) ?? HOT_BANDS[HOT_BANDS.length - 1]).level;
}

export function hotMeta(level: HotLevel): { label: string; note: string; min: number } {
  const band = HOT_BANDS.find((b) => b.level === level) ?? HOT_BANDS[HOT_BANDS.length - 1];
  return { label: band.label, note: band.note, min: band.min };
}

/** Màu của thanh ⚡: càng yếu càng ngả về đỏ để đập vào mắt. */
export function hotColor(level: HotLevel): string {
  if (level >= 5) return "var(--good)";
  if (level === 4) return "#16a34a";
  if (level === 3) return "var(--warn)";
  if (level === 2) return "#ea580c";
  return "var(--danger)";
}

export const HOT_BAND_LIST = HOT_BANDS;

// ---- 2. Hạng theo follower ----

export type Rank = "S" | "A" | "B" | "C" | "D" | "E" | "F";

/** Thang quy mô fanpage theo follower. Cùng quy ước `>=` như bảng độ hot. */
const RANKS: { rank: Rank; min: number; color: string; label: string }[] = [
  { rank: "S", min: 10_000, color: "#d97706", label: "Từ 10.000 follower" },
  { rank: "A", min: 5_000, color: "#7c3aed", label: "5.000 – 10.000" },
  { rank: "B", min: 1_000, color: "#2563eb", label: "1.000 – 5.000" },
  { rank: "C", min: 500, color: "#0891b2", label: "500 – 1.000" },
  { rank: "D", min: 100, color: "#16a34a", label: "100 – 500" },
  { rank: "E", min: 50, color: "#65a30d", label: "50 – 100" },
  { rank: "F", min: 0, color: "#64748b", label: "Dưới 50 — page mới / chưa gây dựng" },
];

export function followerRank(follower: number): Rank {
  return (RANKS.find((r) => follower >= r.min) ?? RANKS[RANKS.length - 1]).rank;
}

export function rankMeta(rank: Rank): { color: string; label: string; min: number } {
  const found = RANKS.find((r) => r.rank === rank) ?? RANKS[RANKS.length - 1];
  return { color: found.color, label: found.label, min: found.min };
}

export const RANK_LIST = RANKS;

/**
 * Số ngày của một kỳ báo cáo Fanpage Karma (4 tuần). Cột "Post/ngày" chia tổng
 * số bài trong kỳ cho con số này, nên đổi kỳ báo cáo là phải đổi ở đây.
 */
export const REPORT_DAYS = 28;

/** Số bài đăng trung bình mỗi ngày của một page (hoặc của cả tập page). */
export const postsPerDay = (posts: number): number => posts / REPORT_DAYS;
