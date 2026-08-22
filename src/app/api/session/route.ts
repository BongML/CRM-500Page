import { NextResponse } from "next/server";
import { currentAccount, currentScope } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Trạng thái đăng nhập — client gọi lúc mount để quyết định màn hình đầu. */
export async function GET() {
  const user = await currentAccount();
  if (!user) return NextResponse.json({ authed: false, user: null, scope: null });

  const scope = await currentScope();
  return NextResponse.json({
    authed: true,
    user,
    // Admin có thể đang xem toàn hệ thống (scopeUserId = null) hoặc một tài khoản.
    scope: { admin: !!scope?.admin, userId: scope?.userId ?? null },
  });
}
