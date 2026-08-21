import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { refreshNiches } from "@/lib/aggregate";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Cập nhật ngách (tên/màu/icon) và đồng bộ tập page thuộc ngách.
 * Body: { name, color, pageIds?: string[] }
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { userId } = auth;

  const { id } = await ctx.params;
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

    if (Array.isArray(pageIds) && pageIds.length) {
      const from = await prisma.page.findMany({
        where: { id: { in: pageIds }, userId },
        select: { nicheId: true },
      });
      await prisma.page.updateMany({
        where: { id: { in: pageIds }, userId },
        data: { nicheId: id },
      });
      await refreshNiches([...from.map((p) => p.nicheId), id]);
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
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { userId } = auth;

  const { id } = await ctx.params;
  const moveTo = new URL(req.url).searchParams.get("moveTo");

  const total = await prisma.niche.count({ where: { userId } });
  if (total <= 1) {
    return NextResponse.json({ error: "Phải còn ít nhất 1 ngách." }, { status: 409 });
  }

  const [pages, posts, trends] = await Promise.all([
    prisma.page.count({ where: { nicheId: id, userId } }),
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

    await prisma.$transaction([
      prisma.page.updateMany({ where: { nicheId: id, userId }, data: { nicheId: moveTo } }),
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
