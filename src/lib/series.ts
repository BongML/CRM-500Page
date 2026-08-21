import type { Snapshot } from "./types";

/** Một điểm trên biểu đồ tăng trưởng. */
export type SeriesPoint = { label: string; value: number };

/**
 * Chuỗi lượt xem lấy thẳng từ Snapshot — mỗi lần nhập báo cáo chốt một điểm tại
 * mốc cuối kỳ của báo cáo đó. Karmar không xuất views theo từng ngày, nên đây là
 * chuỗi thật duy nhất có được; nhập càng nhiều kỳ, đường tăng trưởng càng dày.
 */
export function viewsSeries(snapshots: Snapshot[], nicheFilter: string | null): SeriesPoint[] {
  return snapshots
    .filter((s) => (nicheFilter ? s.nicheId === nicheFilter : s.nicheId === null))
    .sort((a, b) => a.takenAt.localeCompare(b.takenAt))
    .map((s) => ({ label: dayLabel(s.takenAt), value: s.views }));
}

/** "2026-08-19T00:00:00.000Z" → "19/08". */
export function dayLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}`;
}
