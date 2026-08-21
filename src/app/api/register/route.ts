import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, newId, validEmail } from "@/lib/auth";
import { checkLimit, clientIp, noteFailure } from "@/lib/ratelimit";
import { setSessionCookie } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIN_PASSWORD = 8;

/**
 * Tự đăng ký tài khoản. Mỗi tài khoản là một không gian dữ liệu rỗng: ngách,
 * nhóm và page chỉ xuất hiện khi chính chủ nhập báo cáo của mình.
 *
 * Body: { email, password, name? }
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    name?: string;
  };

  // Chặn tạo hàng loạt tài khoản rác từ một nguồn.
  const key = `register:${clientIp(req)}`;
  const limit = checkLimit(key);
  if (!limit.ok) {
    return NextResponse.json(
      { error: `Đăng ký quá nhiều lần. Thử lại sau ${Math.ceil(limit.retryAfter / 60)} phút.` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim() || email.split("@")[0];

  if (!validEmail(email)) {
    return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Mật khẩu phải từ ${MIN_PASSWORD} ký tự trở lên.` },
      { status: 400 },
    );
  }

  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) {
    noteFailure(key);
    return NextResponse.json({ error: "Email này đã có tài khoản." }, { status: 409 });
  }

  const user = await prisma.user.create({
    data: { id: newId(), email, name, password: hashPassword(password) },
    select: { id: true, email: true, name: true },
  });

  await setSessionCookie(user.id);
  return NextResponse.json({ ok: true, user });
}
