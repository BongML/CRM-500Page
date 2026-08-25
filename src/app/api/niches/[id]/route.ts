import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { refreshNiches } from "@/lib/aggregate";
import { runBatch } from "@/lib/batch";
import { requireScope, scopeWhere } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Cập nhật ngách (tên/màu/icon) và đồng bộ tập page thuộc ngách.
 * Body: { name, color, pageIds?: string[] }
 *
 * `pageIds` là **danh sách thành viên đầy đủ** của ngách sau khi sửa: page có
 * trong danh sách được thêm ngách này, page đang mang ngách này mà vắng mặt thì
 * bị gỡ ra. Các ngách khác của page không bị đụng tới — một page giữ nhiều ngách.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  // Chủ sở hữu lấy từ chính ngách: tài khoản tổng sửa được ngách của mọi người,
  // nhưng tập page gán vào vẫn phải là page của cùng chủ đó.
  const owner = await prisma.niche.findFirst({
    where: { id, ...scopeWhere(auth.scope) },
    select: { userId: true },
  });
  if (!owner) return NextResponse.json({ error: "Ngách không còn tồn tại." }, { status: 404 });
  const userId = owner.userId;
  const { name, color, pageIds } = (await req.json()) as {
    name?: string;
    color?: string;
    pageIds?: string[];
  };

  const label = (name ?? "").trim() || "Ngách mới";

  try {
    const done = await prisma.niche.updateMany({
      where: { id, userId },
      data: {
        name: label,
        icon: label[0].toUpperCase(),
        ...(color ? { color } : {}),
      },
    });
    if (!done.count) {
      return NextResponse.json({ error: "Ngách không còn tồn tại." }, { status: 404 });
    }

    if (Array.isArray(pageIds)) {
      const wanted = new Set(pageIds);
      // Lấy cả page sắp vào lẫn page đang ở trong ngách: chỉ hai nhóm này có thể
      // đổi trạng thái thành viên.
      const affected = await prisma.page.findMany({
        where: { userId, OR: [{ id: { in: pageIds } }, { nicheIds: { has: id } }] },
        select: { id: true, nicheIds: true },
      });

      await runBatch(
        affected
          .filter((p) => p.nicheIds.includes(id) !== wanted.has(p.id))
          .map((p) =>
            prisma.page.update({
              where: { id: p.id },
              data: {
                nicheIds: wanted.has(p.id)
                  ? [...p.nicheIds, id]
                  : p.nicheIds.filter((x) => x !== id),
              },
            }),
          ),
      );
      await refreshNiches([id]);
    }

    return NextResponse.json(await prisma.niche.findUniqueOrThrow({ where: { id } }));
  } catch (e) {
    return apiError(e, "Không cập nhật được ngách.");
  }
}

/**
 * Xóa ngách. Nếu còn page/top-post/trend thì phải kèm ?moveTo=<nicheId> để
 * chuyển toàn bộ sang ngách khác trước khi xóa.
 */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const moveTo = new URL(req.url).searchParams.get("moveTo");

  const owner = await prisma.niche.findFirst({
    where: { id, ...scopeWhere(auth.scope) },
    select: { userId: true },
  });
  if (!owner) return NextResponse.json({ error: "Ngách không còn tồn tại." }, { status: 404 });
  const userId = owner.userId;

  // "Phải còn ít nhất 1 ngách" xét trong không gian của chủ ngách, không phải
  // trên toàn hệ thống.
  const total = await prisma.niche.count({ where: { userId } });
  if (total <= 1) {
    return NextResponse.json({ error: "Phải còn ít nhất 1 ngách." }, { status: 409 });
  }

  const [pages, posts, trends] = await Promise.all([
    prisma.page.count({ where: { nicheIds: { has: id }, userId } }),
    prisma.topPost.count({ where: { nicheId: id, userId } }),
    prisma.trend.count({ where: { nicheId: id, userId } }),
  ]);

  if (pages + posts + trends > 0) {
    if (!moveTo || moveTo === id) {
      return NextResponse.json(
        { error: `Ngách còn ${pages} page. Chọn ngách để chuyển sang trước khi xóa.`, pages },
        { status: 409 },
      );
    }
    const target = await prisma.niche.findFirst({ where: { id: moveTo, userId } });
    if (!target) return NextResponse.json({ error: "Ngách đích không tồn tại." }, { status: 400 });

    // Page: thay ngách sắp xóa bằng ngách đích ngay tại chỗ cũ trong mảng, bỏ
    // trùng nếu page vốn đã mang sẵn ngách đích. Các ngách khác của page giữ nguyên.
    const affected = await prisma.page.findMany({
      where: { nicheIds: { has: id }, userId },
      select: { id: true, nicheIds: true },
    });
    await runBatch(
      affected.map((p) =>
        prisma.page.update({
          where: { id: p.id },
          data: { nicheIds: [...new Set(p.nicheIds.map((x) => (x === id ? moveTo : x)))] },
        }),
      ),
    );

    await prisma.$transaction([
      prisma.topPost.updateMany({ where: { nicheId: id, userId }, data: { nicheId: moveTo } }),
      prisma.trend.updateMany({ where: { nicheId: id, userId }, data: { nicheId: moveTo } }),
    ]);
  }

  try {
    const done = await prisma.niche.deleteMany({ where: { id, userId } });
    if (!done.count) {
      return NextResponse.json({ error: "Ngách không còn tồn tại." }, { status: 404 });
    }
    if (moveTo) await refreshNiches([moveTo]);
    return NextResponse.json({ ok: true, movedTo: moveTo ?? null });
  } catch (e) {
    return apiError(e, "Không xóa được ngách.");
  }
}
