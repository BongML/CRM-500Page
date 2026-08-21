/**
 * Chặn dò mật khẩu ở mức tối thiểu: đếm số lần thất bại theo (IP + email) trong
 * một cửa sổ thời gian, quá ngưỡng thì khóa tạm.
 *
 * Bộ đếm nằm trong RAM của từng instance. Trên serverless nhiều instance thì
 * mỗi instance đếm riêng, nên đây là *giảm thiệt hại*, không phải hàng rào tuyệt
 * đối — muốn chặt hơn phải đưa bộ đếm sang Redis/Upstash. Vẫn đáng có: nó cắt
 * đứt kiểu dò hàng nghìn mật khẩu trên một kết nối.
 */

type Bucket = { fails: number; until: number };

const HITS = new Map<string, Bucket>();

/** Số lần sai liên tiếp trước khi khóa. */
const MAX_FAILS = 8;
/** Thời gian khóa sau khi vượt ngưỡng. */
const LOCK_MS = 10 * 60 * 1000;
/** Quá lâu không thử lại thì quên đi. */
const FORGET_MS = 15 * 60 * 1000;
/** Dọn map khi phình quá — chống ngốn RAM nếu bị bơm nhiều key rác. */
const MAX_KEYS = 5000;

function sweep(now: number) {
  for (const [key, b] of HITS) {
    if (b.until < now) HITS.delete(key);
  }
  if (HITS.size > MAX_KEYS) HITS.clear();
}

/** IP người gọi theo header proxy của Vercel; không có thì gộp chung một rổ. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}

/** Còn được thử không? Trả số giây phải chờ nếu đang bị khóa. */
export function checkLimit(key: string): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const bucket = HITS.get(key);
  if (!bucket || bucket.until < now) return { ok: true, retryAfter: 0 };
  if (bucket.fails < MAX_FAILS) return { ok: true, retryAfter: 0 };
  return { ok: false, retryAfter: Math.ceil((bucket.until - now) / 1000) };
}

/** Ghi nhận một lần thất bại. */
export function noteFailure(key: string) {
  const now = Date.now();
  sweep(now);

  const bucket = HITS.get(key);
  if (!bucket || bucket.until < now) {
    HITS.set(key, { fails: 1, until: now + FORGET_MS });
    return;
  }

  bucket.fails++;
  // Chạm ngưỡng thì chuyển từ "cửa sổ quên" sang "cửa sổ khóa".
  bucket.until = bucket.fails >= MAX_FAILS ? now + LOCK_MS : now + FORGET_MS;
}

/** Thành công thì xóa lịch sử thất bại. */
export function clearFailures(key: string) {
  HITS.delete(key);
}
