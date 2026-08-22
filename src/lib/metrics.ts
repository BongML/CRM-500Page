import { REPORT_DAYS, followerRank, hotColor, hotLevel, type HotLevel, type Rank } from "./rank";
import { statusOf } from "./format";
import type { Owner, Page } from "./types";

/**
 * Số liệu cộng dồn của **một tập page bất kỳ** — cùng một hàm dùng cho KPI
 * dashboard, bảng "Hiệu suất page người nắm" và dòng tổng của cây phân cấp.
 * Gom vào một chỗ để ba nơi không bao giờ lệch cách tính: `rate` và `ppi` luôn
 * là trung bình **theo page** (mỗi page một phiếu), giống hệt cách
 * `refreshNiches` tính cột agg* của ngách ở server.
 *
 * Mọi con số ở đây tính thẳng từ báo cáo đã nhập, không đọc thêm DB.
 */
export type PageStats = {
  pages: number;
  /** Page có ít nhất 1 bài trong kỳ báo cáo. */
  posting: number;
  /** Page không đăng bài nào trong kỳ — phần cần soi. */
  silent: number;
  follower: number;
  posts: number;
  postsPerDay: number;
  views: number;
  reach: number;
  likes: number;
  comments: number;
  /** Like + comment cộng lại. */
  interactions: number;
  /** Post interaction rate trung bình (%). */
  rate: number;
  /** Page Performance Index trung bình (%). */
  ppi: number;
  /** Ngách **đã triển khai**: chỉ những ngách thực sự có page trong tập này. */
  nicheIds: string[];
};

export const EMPTY_STATS: PageStats = {
  pages: 0,
  posting: 0,
  silent: 0,
  follower: 0,
  posts: 0,
  postsPerDay: 0,
  views: 0,
  reach: 0,
  likes: 0,
  comments: 0,
  interactions: 0,
  rate: 0,
  ppi: 0,
  nicheIds: [],
};

export function statsOf(pages: Page[]): PageStats {
  if (!pages.length) return EMPTY_STATS;

  const niches = new Set<string>();
  let posting = 0;
  let follower = 0;
  let posts = 0;
  let views = 0;
  let reach = 0;
  let likes = 0;
  let comments = 0;
  let rate = 0;
  let ppi = 0;

  for (const p of pages) {
    if (p.posts > 0) posting += 1;
    follower += p.follower;
    posts += p.posts;
    views += p.views;
    reach += p.reach;
    likes += p.likes;
    comments += p.comments;
    rate += p.rate;
    ppi += p.ppi;
    niches.add(p.nicheId);
  }

  const n = pages.length;
  return {
    pages: n,
    posting,
    silent: n - posting,
    follower,
    posts,
    postsPerDay: posts / REPORT_DAYS,
    views,
    reach,
    likes,
    comments,
    interactions: likes + comments,
    rate: +(rate / n).toFixed(2),
    ppi: Math.round(ppi / n),
    nicheIds: [...niches],
  };
}

/**
 * Một dòng của bảng "Hiệu suất page người nắm".
 *
 * "Người nắm" = tài khoản đang giữ page đó (`page.userId`). Chỉ có nghĩa khi
 * tài khoản tổng đang xem gộp toàn hệ thống; ở phạm vi một tài khoản thì mọi
 * page đều cùng một người nắm nên bảng này không hiện.
 */
export type OwnerStats = { owner: Owner; stats: PageStats };

/**
 * Xếp page về từng người nắm. Người chưa có page nào vẫn giữ lại một dòng rỗng
 * — admin cần thấy tài khoản nào đang trống để nhắc nhập báo cáo, chứ không
 * phải để họ biến mất khỏi bảng.
 *
 * Sắp theo tổng views giảm dần: người kéo nhiều view nhất cho hệ thống lên đầu.
 */
export function statsByOwner(pages: Page[], owners: Owner[]): OwnerStats[] {
  const bucket = new Map<string, Page[]>();
  for (const p of pages) {
    if (!p.userId) continue;
    const cur = bucket.get(p.userId);
    if (cur) cur.push(p);
    else bucket.set(p.userId, [p]);
  }

  return owners
    .map((owner) => ({ owner, stats: statsOf(bucket.get(owner.id) ?? []) }))
    .sort((a, b) => b.stats.views - a.stats.views);
}

/** Một bậc của biểu đồ phân bổ: nhãn, màu, số page rơi vào bậc đó. */
export type Band = { key: string; label: string; color: string; count: number };

/**
 * PPI đại diện cho từng bậc trạng thái, theo đúng thứ tự muốn hiển thị. Nhãn và
 * màu **lấy từ `statusOf`** chứ không chép lại: đổi ngưỡng hay đổi chữ ở
 * lib/format.ts thì biểu đồ đổi theo, không bao giờ đếm hụt vì lệch chuỗi.
 */
const STATUS_ANCHORS = [100, 70, 0];

/** Phân bổ page theo trạng thái PPI (Hiệu quả / Trung bình / Cần review). */
export function statusBands(pages: Page[]): Band[] {
  const bands: Band[] = STATUS_ANCHORS.map((ppi) => {
    const s = statusOf(ppi);
    return { key: s.label, label: s.label, color: s.color, count: 0 };
  });

  const index = new Map(bands.map((b) => [b.key, b]));
  for (const p of pages) index.get(statusOf(p.ppi).label)!.count += 1;

  return bands;
}

/** Phân bổ page theo độ hot ⚡ (5 → 1). */
export function hotBands(pages: Page[]): (Band & { level: HotLevel })[] {
  const counts = new Map<HotLevel, number>();
  for (const p of pages) {
    const l = hotLevel(p.views);
    counts.set(l, (counts.get(l) ?? 0) + 1);
  }
  return ([5, 4, 3, 2, 1] as HotLevel[]).map((level) => ({
    key: String(level),
    level,
    label: `${level}⚡`,
    color: hotColor(level),
    count: counts.get(level) ?? 0,
  }));
}

/** Phân bổ page theo hạng quy mô follower (S → F). */
export function rankBands(pages: Page[]): { rank: Rank; count: number }[] {
  const counts = new Map<Rank, number>();
  for (const p of pages) {
    const r = followerRank(p.follower);
    counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  return (["S", "A", "B", "C", "D", "E", "F"] as Rank[]).map((rank) => ({
    rank,
    count: counts.get(rank) ?? 0,
  }));
}
