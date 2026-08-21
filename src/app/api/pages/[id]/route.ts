import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { refreshNiches } from "@/lib/aggregate";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Cập nhật 1 page: đổi ngách (từ trang chi tiết) hoặc chuyển sub-group (kéo-thả).
 * Body: { nicheId? } | { groupId, subId }
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { userId } = auth;

  const { id } = await ctx.params;
  const body = (await req.json()) as { nicheId?: string; groupId?: string; subId?: string };

  const data: { nicheId?: string; groupId?: string; subId?: string } = {};
  if (body.nicheId) data.nicheId = body.nicheId;
  if (body.groupId) data.groupId = body.groupId;
  if (body.subId) data.subId = body.subId;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Không có trường nào để cập nhật." }, { status: 400 });
  }

  // Chuyển sub-group phải kèm group tương ứng để dữ liệu không lệch.
  if (data.subId) {
    const sub = await prisma.subGroup.findFirst({ where: { id: data.subId, userId } });
    if (!sub) return NextResponse.json({ error: "Sub-group không tồn tại." }, { status: 400 });
    data.groupId = sub.groupId;
  }
  if (data.nicheId) {
    const niche = await prisma.niche.findFirst({ where: { id: data.nicheId, userId } });
    if (!niche) return NextResponse.json({ error: "Ngách không tồn tại." }, { status: 400 });
  }

  try {
    const before = await prisma.page.findFirst({
      where: { id, userId },
      select: { nicheId: true },
    });
    if (!before) return NextResponse.json({ error: "Page không còn tồn tại." }, { status: 404 });

    await prisma.page.updateMany({ where: { id, userId }, data });
    const page = await prisma.page.findUniqueOrThrow({ where: { id } });

    // Đổi ngách làm lệch số tổng hợp của cả ngách cũ lẫn ngách mới.
    if (before.nicheId !== page.nicheId) await refreshNiches([before.nicheId, page.nicheId]);
    return NextResponse.json(page);
  } catch (e) {
    return apiError(e, "Không cập nhật được page.");
  }
}

/** Xóa 1 page khỏi hệ thống. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  try {
    const page = await prisma.page.findFirst({
      where: { id, userId: auth.userId },
      select: { nicheId: true },
    });
    if (!page) return NextResponse.json({ error: "Page không còn tồn tại." }, { status: 404 });

    await prisma.page.deleteMany({ where: { id, userId: auth.userId } });
    await refreshNiches([page.nicheId]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "Không xóa được page.");
  }
}
