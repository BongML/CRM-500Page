import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * Mật khẩu và phiên đăng nhập — chỉ dùng node:crypto, không thêm thư viện.
 *
 *  - Mật khẩu lưu dạng "salt:hash" (scrypt). Không bao giờ lưu bản rõ.
 *  - Cookie phiên là "userId.hạn.chữ ký": server tự xác thực được bằng khóa bí
 *    mật mà không cần bảng session. Đổi CRM_SESSION_SECRET = đăng xuất tất cả.
 */

const SCRYPT_KEYLEN = 32;
/** Phiên sống 30 ngày, gia hạn mỗi lần đăng nhập. */
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

/** ID nội bộ cho mọi bản ghi. Ngẫu nhiên nên không đụng nhau giữa các tài khoản. */
export const newId = (): string => randomUUID();

function secret(): string {
  const key = process.env.CRM_SESSION_SECRET;
  if (key && key.length >= 16) return key;
  // Thiếu khóa thì vẫn chạy được ở máy dev, nhưng phải kêu to: khóa mặc định
  // nghĩa là ai cũng ký được cookie hợp lệ.
  if (process.env.NODE_ENV === "production") {
    throw new Error("Thiếu CRM_SESSION_SECRET — không thể ký phiên đăng nhập an toàn.");
  }
  return "crm-dev-secret-doi-truoc-khi-len-that";
}

export function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(plain, salt, SCRYPT_KEYLEN).toString("hex")}`;
}

export function verifyPassword(plain: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(plain, salt, expected.length || SCRYPT_KEYLEN);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const sign = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

/** Token phiên cho một user, kèm hạn dùng. */
export function signSession(userId: string): string {
  const payload = `${userId}.${Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS}`;
  return `${payload}.${sign(payload)}`;
}

/** Trả userId nếu token còn hạn và chữ ký khớp, ngược lại null. */
export function readSession(token: string | undefined): string | null {
  if (!token) return null;

  const cut = token.lastIndexOf(".");
  if (cut < 0) return null;

  const payload = token.slice(0, cut);
  const signature = token.slice(cut + 1);

  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  const [userId, exp] = payload.split(".");
  if (!userId || !exp) return null;
  if (Number(exp) * 1000 < Date.now()) return null;

  return userId;
}

/** Email hợp lệ ở mức đủ dùng cho công cụ nội bộ. */
export const validEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
