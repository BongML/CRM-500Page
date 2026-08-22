import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { requireScope, scopeWhere } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Đổi tên sub-group. Body: { name } */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const { name } = (await req.json()) as { name?: string };

  const label = (name ?? "").trim();
  if (!label) {
    return NextResponse.json({ error: "Tên sub-group không được để trống." }, { status: 400 });
  }

  try {
    const done = await prisma.subGroup.updateMany({
      where: { id, ...scopeWhere(auth.scope) },
      data: { name: label },
    });
    if (!done.count) {
      return NextResponse.json({ error: "Sub-group không còn tồn tại." }, { status: 404 });
    }
    return NextResponse.json(await prisma.subGroup.findUniqueOrThrow({ where: { id } }));
  } catch (e) {
    return apiError(e, "Không đổi tên được sub-group.");
  }
}

/** Xóa sub-group — chỉ khi rỗng. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const sub = await prisma.subGroup.findFirst({
    where: { id, ...scopeWhere(auth.scope) },
    select: { id: true },
  });
  if (!sub) return NextResponse.json({ error: "Sub-group không còn tồn tại." }, { status: 404 });

  const pages = await prisma.page.count({ where: { subId: id } });
  if (pages > 0) {
    return NextResponse.json(
      { error: `Sub-group còn ${pages} page. Chuyển các page đi trước khi xóa.` },
      { status: 409 },
    );
  }

  try {
    const done = await prisma.subGroup.deleteMany({ where: { id, ...scopeWhere(auth.scope) } });
    if (!done.count) {
      return NextResponse.json({ error: "Sub-group không còn tồn tại." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "Không xóa được sub-group.");
  }
}
