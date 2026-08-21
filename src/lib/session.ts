import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { readSession, signSession, SESSION_TTL_SECONDS } from "./auth";

export const SESSION_COOKIE = "crm_session";

/**
 * Cổng vào của mọi route có dữ liệu. Toàn bộ bảng nghiệp vụ đều mang `userId`,
 * nên **mọi truy vấn phải kèm userId lấy từ đây** — quên một chỗ là dữ liệu của
 * người này lọt sang người khác.
 */

/** userId của phiên hiện tại, hoặc null nếu chưa đăng nhập / token hết hạn. */
export async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  return readSession(jar.get(SESSION_COOKIE)?.value);
}

/** Phiên hiện tại kèm thông tin tài khoản (null nếu user đã bị xóa). */
export async function currentUser() {
  const id = await currentUserId();
  if (!id) return null;
  return prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true } });
}

/** 401 chuẩn cho route cần đăng nhập. */
export const unauthorized = (message = "Cần đăng nhập.") =>
  NextResponse.json({ error: message }, { status: 401 });

/**
 * Dùng ở đầu mỗi route: trả userId, hoặc `response` 401 để route trả về ngay.
 *
 *   const auth = await requireUser();
 *   if (!auth.ok) return auth.response;
 *   // từ đây auth.userId là string
 */
export type Auth = { ok: true; userId: string } | { ok: false; response: NextResponse };

export async function requireUser(message?: string): Promise<Auth> {
  const userId = await currentUserId();
  return userId ? { ok: true, userId } : { ok: false, response: unauthorized(message) };
}

export async function setSessionCookie(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
