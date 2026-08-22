import type { Snapshot } from "./types";

/** Một điểm trên biểu đồ tăng trưởng. */
export type SeriesPoint = { label: string; value: number };

/**
 * Chỉ số vẽ được theo thời gian. Đúng bằng những cột Snapshot đang chốt lại mỗi
 * kỳ — không thêm chỉ số nào không có số liệu lịch sử thật (follower và số bài
 * đăng chưa được chốt vào Snapshot nên **không** có mặt ở đây).
 */
export type SnapMetric = "views" | "reach" | "rate" | "ppi" | "pages";

export const SNAP_METRICS: { id: SnapMetric; label: string; unit: "count" | "pct" }[] = [
  { id: "views", label: "Lượt xem", unit: "count" },
  { id: "reach", label: "Reach/ngày", unit: "count" },
  { id: "rate", label: "Tương tác", unit: "pct" },
  { id: "ppi", label: "PPI", unit: "pct" },
  { id: "pages", label: "Số page", unit: "count" },
];

export const metricMeta = (m: SnapMetric) =>
  SNAP_METRICS.find((x) => x.id === m) ?? SNAP_METRICS[0];

/**
 * Chuỗi một chỉ số lấy thẳng từ Snapshot — mỗi lần nhập báo cáo chốt một điểm
 * tại mốc cuối kỳ của báo cáo đó. Karmar không xuất số liệu theo từng ngày, nên
 * đây là chuỗi thật duy nhất có được; nhập càng nhiều kỳ, đường càng dày.
 */
export function metricSeries(
  snapshots: Snapshot[],
  nicheFilter: string | null,
  metric: SnapMetric,
): SeriesPoint[] {
  return snapshots
    .filter((s) => (nicheFilter ? s.nicheId === nicheFilter : s.nicheId === null))
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
    .map((s) => ({ label: dayLabel(s.takenAt), value: s[metric] }));
}

/** Mức thay đổi giữa hai mốc cuối cùng của một chuỗi. */
export type Delta = { pct: number; prevLabel: string };

/**
 * So kỳ gần nhất với kỳ liền trước. Trả null khi mới có một kỳ (chưa so được)
 * hoặc khi kỳ trước bằng 0 — chia cho 0 sẽ ra "tăng vô hạn", vô nghĩa trên KPI.
 */
export function lastDelta(points: SeriesPoint[]): Delta | null {
  if (points.length < 2) return null;
  const cur = points[points.length - 1];
  const prev = points[points.length - 2];
  if (!prev.value) return null;
  return { pct: +(((cur.value - prev.value) / prev.value) * 100).toFixed(1), prevLabel: prev.label };
}

/** "2026-08-19T00:00:00.000Z" → "19/08". */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`;
}

/** Bản ghi snapshot ở cả hai dạng: Date (server/Prisma) và ISO string (client). */
export type SnapshotLike = {
  id: string;
  takenAt: Date | string;
  nicheId: string | null;
  pages: number;
  views: number;
  reach: number;
  rate: number;
  ppi: number;
};

const iso = (t: Date | string) => (typeof t === "string" ? t : t.toISOString());

/**
 * Gộp snapshot trùng mốc (cùng ngách, cùng ngày) thành một điểm.
 *
 * Cần cho tài khoản tổng: mỗi user chốt riêng một snapshot "toàn hệ thống" mỗi
 * kỳ, để nguyên thì biểu đồ có 3 điểm chồng lên nhau ở cùng một ngày. Page /
 * views / reach cộng lại; rate và ppi lấy trung bình có trọng số theo số page —
 * user 500 page phải nặng hơn user 200 page.
 *
 * Với một tài khoản đơn lẻ, mỗi (ngách, ngày) vốn đã duy nhất nên hàm này không
 * đổi gì. Trả về theo thứ tự thời gian tăng dần, giữ lại `limit` điểm cuối.
 */
export function mergeSnapshots<T extends SnapshotLike>(rows: T[], limit: number): Snapshot[] {
  const bucket = new Map<string, Snapshot & { rateSum: number; ppiSum: number; weight: number }>();

  for (const r of rows) {
    const at = iso(r.takenAt);
    const key = `${r.nicheId ?? "all"}|${at.slice(0, 10)}`;
    const w = r.pages || 1;
    const cur = bucket.get(key);

    if (!cur) {
      bucket.set(key, {
        id: r.id,
        takenAt: at,
        nicheId: r.nicheId,
        pages: r.pages,
        views: r.views,
        reach: r.reach,
        rate: r.rate,
        ppi: r.ppi,
        rateSum: r.rate * w,
        ppiSum: r.ppi * w,
        weight: w,
      });
      continue;
    }

    cur.pages += r.pages;
    cur.views += r.views;
    cur.reach += r.reach;
    cur.rateSum += r.rate * w;
    cur.ppiSum += r.ppi * w;
    cur.weight += w;
    cur.rate = +(cur.rateSum / cur.weight).toFixed(2);
    cur.ppi = Math.round(cur.ppiSum / cur.weight);
    // Mốc chính xác nhất là mốc muộn nhất trong ngày.
    if (at > cur.takenAt) cur.takenAt = at;
  }

  const points = [...bucket.values()]
    .map(({ rateSum: _r, ppiSum: _p, weight: _w, ...s }) => s)
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt));

  return points.slice(-limit);
}
