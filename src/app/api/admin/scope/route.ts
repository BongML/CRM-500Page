import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ALL_SCOPE, requireAdmin, setScopeCookie } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Đổi phạm vi dữ liệu của admin. Body: { userId: string | "all" | null }
 *
 * "all" = xem gộp mọi tài khoản (A 200 + B 500 + C 300 = 1000 page). Chọn một
 * userId = bước hẳn vào không gian của người đó để tạo nhóm / nhập báo cáo hộ.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { userId } = (await req.json().catch(() => ({}))) as { userId?: string | null };

  if (!userId || userId === ALL_SCOPE) {
    await setScopeCookie(null);
    return NextResponse.json({ ok: true, userId: null });
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true },
  });
  if (!target) return NextResponse.json({ error: "Tài khoản không tồn tại." }, { status: 404 });

  await setScopeCookie(target.id);
  return NextResponse.json({ ok: true, userId: target.id, user: target });
}
