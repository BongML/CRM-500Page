import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth";
import { checkLimit, clearFailures, clientIp, noteFailure } from "@/lib/ratelimit";
import { clearSessionCookie, setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Đăng nhập bằng tài khoản đã đăng ký. Body: { email, password } */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  // Khóa theo (IP + email) để một người dò nhiều tài khoản cũng bị chặn.
  const key = `login:${clientIp(req)}:${email}`;
  const limit = checkLimit(key);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Sai quá nhiều lần. Thử lại sau ${Math.ceil(limit.retryAfter / 60)} phút.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // Cùng một thông báo cho email sai lẫn mật khẩu sai — không tiết lộ email nào đã đăng ký.
  if (!user || !verifyPassword(password, user.password)) {
    noteFailure(key);
    return NextResponse.json({ error: "Email hoặc mật khẩu không đúng." }, { status: 401 });
  }

  clearFailures(key);
  await setSessionCookie(user.id);
  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
}

/** Đăng xuất. */
export async function DELETE() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
