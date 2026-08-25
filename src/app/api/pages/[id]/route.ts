import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { refreshNiches } from "@/lib/aggregate";
import { cleanNiches, ownedNiches } from "@/lib/niche";
import { requireScope, scopeWhere } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Cập nhật 1 page: đổi ngách (từ trang chi tiết) hoặc chuyển sub-group (kéo-thả).
 * Body: { nicheIds? } | { groupId, subId }
 *
 * `nicheIds` là **toàn bộ** tập ngách của page sau khi sửa, không phải phần thêm
 * vào: gửi mảng rỗng là gỡ page khỏi mọi ngách. Phần tử đầu là ngách chính.
 *
 * Chủ sở hữu lấy từ **chính page** chứ không từ phiên: tài khoản tổng sửa được
 * page của mọi người, nhưng ngách/nhóm đích vẫn buộc phải cùng chủ với page —
 * không có đường nào đẩy page của A sang nhóm của B.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = (await req.json()) as {
    nicheIds?: string[];
    groupId?: string;
    subId?: string;
  };

  const data: { nicheIds?: string[]; groupId?: string; subId?: string } = {};
  if (Array.isArray(body.nicheIds)) data.nicheIds = cleanNiches(body.nicheIds);
  if (body.groupId) data.groupId = body.groupId;
  if (body.subId) data.subId = body.subId;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Không có trường nào để cập nhật." }, { status: 400 });
  }

  const before = await prisma.page.findFirst({
    where: { id, ...scopeWhere(auth.scope) },
    select: { nicheIds: true, userId: true },
  });
  if (!before) return NextResponse.json({ error: "Page không còn tồn tại." }, { status: 404 });

  const userId = before.userId;

  // Chuyển sub-group phải kèm group tương ứng để dữ liệu không lệch.
  if (data.subId) {
    const sub = await prisma.subGroup.findFirst({ where: { id: data.subId, userId } });
    if (!sub) return NextResponse.json({ error: "Sub-group không tồn tại." }, { status: 400 });
    data.groupId = sub.groupId;
  }
  if (data.nicheIds?.length) {
    const valid = await ownedNiches(userId, data.nicheIds);
    if (valid.length !== data.nicheIds.length) {
      return NextResponse.json({ error: "Ngách không tồn tại." }, { status: 400 });
    }
    data.nicheIds = valid;
  }

  try {
    await prisma.page.updateMany({ where: { id, userId }, data });
    const page = await prisma.page.findUniqueOrThrow({ where: { id } });

    // Đổi ngách làm lệch số tổng hợp của cả ngách vừa rời lẫn ngách vừa vào.
    if (data.nicheIds) await refreshNiches([...before.nicheIds, ...page.nicheIds]);
    return NextResponse.json(page);
  } catch (e) {
    return apiError(e, "Không cập nhật được page.");
  }
}

/** Xóa 1 page khỏi hệ thống, kèm top content của chính page đó. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  try {
    const page = await prisma.page.findFirst({
      where: { id, ...scopeWhere(auth.scope) },
      select: { nicheIds: true, userId: true },
    });
    if (!page) return NextResponse.json({ error: "Page không còn tồn tại." }, { status: 404 });

    // Xóa bài của page trước: giữ lại thì chúng thành mồ côi mà vẫn tính vào ngách.
    await prisma.topPost.deleteMany({ where: { userId: page.userId, pageId: id } });
    await prisma.page.deleteMany({ where: { id, userId: page.userId } });
    await refreshNiches(page.nicheIds);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "Không xóa được page.");
  }
}
