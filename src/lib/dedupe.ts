import { pageSlug, type MetricsRow, type PostRow } from "./karmar";

/**
 * Lọc trùng cho một lần nhập nhiều file báo cáo.
 *
 * Mỗi file là báo cáo của một số page, và các file thường chồng lấn nhau (cùng
 * một page nằm trong nhiều dashboard, hoặc cùng một list page được export lại
 * theo kỳ mới). Trước khi ghi xuống DB, gộp tất cả các dòng lại theo khóa định
 * danh và chỉ giữ một bản: bản của báo cáo có kỳ mới nhất.
 *
 * Khóa định danh:
 *  - page: Profile-ID của Fanpage Karma; thiếu thì rơi về tên đã chuẩn hóa;
 *  - bài viết: Message-ID.
 */

/** Một lần xuất hiện của bản ghi trong lô nhập. */
export type Occurrence = { file: string; reportedAt: string | null };

/** Bản ghi đã chọn + những lần xuất hiện trùng đã bị loại. */
export type Merged<T> = {
  key: string;
  row: T;
  kept: Occurrence;
  dropped: Occurrence[];
};

/** Dòng trùng để hiển thị trong báo cáo kết quả nhập. */
export type DuplicateHit = {
  label: string;
  kept: Occurrence;
  dropped: Occurrence[];
};

/** Cùng tên page nhưng khác Profile-ID — không tự gộp, chỉ cảnh báo. */
export type NameClash = { name: string; ids: string[] };

/** Một file đã đọc xong, chờ gộp. */
export type Batch<T> = { file: string; reportedAt: Date | null; rows: T[] };

export type DedupeResult<T> = {
  /** Danh sách đã loại trùng, giữ thứ tự gặp lần đầu. */
  merged: Merged<T>[];
  duplicates: DuplicateHit[];
  /** Tổng số dòng đã đọc, kể cả dòng bị loại. */
  scanned: number;
};

const iso = (d: Date | null) => (d ? d.toISOString() : null);

/** Mốc so sánh độ mới; không đọc được kỳ báo cáo thì coi như cũ nhất. */
const freshness = (d: Date | null) => (d ? d.getTime() : -Infinity);

/**
 * Gộp nhiều lô theo khóa. Trùng trong cùng một file cũng được loại (Karmar lặp
 * dòng khi một page nằm ở nhiều nhóm của cùng một dashboard).
 *
 * Bản thắng là bản thuộc kỳ báo cáo mới nhất; hai bản cùng kỳ (hoặc đều không
 * đọc được kỳ) thì file đứng sau trong danh sách thắng.
 */
function mergeByKey<T>(
  batches: Batch<T>[],
  keyOf: (row: T) => string,
  labelOf: (row: T) => string,
): DedupeResult<T> {
  type Entry = Merged<T> & { at: number };

  const byKey = new Map<string, Entry>();
  const order: string[] = [];
  let scanned = 0;

  for (const batch of batches) {
    const here: Occurrence = { file: batch.file, reportedAt: iso(batch.reportedAt) };
    const at = freshness(batch.reportedAt);

    for (const row of batch.rows) {
      scanned++;
      const key = keyOf(row);
      const seen = byKey.get(key);

      if (!seen) {
        byKey.set(key, { key, row, kept: here, dropped: [], at });
        order.push(key);
      } else if (at >= seen.at) {
        seen.dropped.push(seen.kept);
        seen.row = row;
        seen.kept = here;
        seen.at = at;
      } else {
        seen.dropped.push(here);
      }
    }
  }

  const merged = order.map((k) => byKey.get(k)!);

  return {
    merged,
    scanned,
    duplicates: merged
      .filter((m) => m.dropped.length > 0)
      .map((m) => ({ label: labelOf(m.row), kept: m.kept, dropped: m.dropped })),
  };
}

/** Khóa của một page: Profile-ID, hoặc tên đã chuẩn hóa khi báo cáo thiếu ID. */
export function pageKey(row: { id: string; slug: string }): string {
  return row.id || `name:${row.slug}`;
}

export function dedupePages(batches: Batch<MetricsRow>[]): DedupeResult<MetricsRow> {
  return mergeByKey(batches, pageKey, (r) => r.name);
}

export function dedupePosts(batches: Batch<PostRow>[]): DedupeResult<PostRow> {
  return mergeByKey(
    batches,
    (r) => r.id,
    (r) => r.caption.slice(0, 80) || r.pageName,
  );
}

/**
 * Các tên page xuất hiện với nhiều Profile-ID khác nhau. Đây là trùng "nghi
 * ngờ": có thể là hai page thật sự khác nhau trùng tên, nên không tự gộp mà
 * báo lên để người dùng tự quyết.
 */
export function nameClashes(rows: { id: string; name: string }[]): NameClash[] {
  const bySlug = new Map<string, { name: string; ids: Set<string> }>();

  for (const row of rows) {
    const slug = pageSlug(row.name);
    if (!slug) continue;
    const entry = bySlug.get(slug) ?? { name: row.name, ids: new Set<string>() };
    entry.ids.add(row.id);
    bySlug.set(slug, entry);
  }

  return [...bySlug.values()]
    .filter((e) => e.ids.size > 1)
    .map((e) => ({ name: e.name, ids: [...e.ids] }));
}
