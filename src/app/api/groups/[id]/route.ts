import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import { requireScope, scopeWhere } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Đổi tên nhóm. Body: { name } */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const { name } = (await req.json()) as { name?: string };

  const label = (name ?? "").trim();
  if (!label) return NextResponse.json({ error: "Tên nhóm không được để trống." }, { status: 400 });

  try {
    // updateMany + bộ lọc phạm vi: nhóm ngoài tầm không đổi được, kể cả khi biết id.
    const done = await prisma.group.updateMany({
      where: { id, ...scopeWhere(auth.scope) },
      data: { name: label },
    });
    if (!done.count) {
      return NextResponse.json({ error: "Nhóm không còn tồn tại." }, { status: 404 });
    }
    return NextResponse.json(await prisma.group.findUniqueOrThrow({ where: { id } }));
  } catch (e) {
    return apiError(e, "Không đổi tên được nhóm.");
  }
}

/** Xóa nhóm — chỉ khi không còn page nào bên trong. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;

  const group = await prisma.group.findFirst({
    where: { id, ...scopeWhere(auth.scope) },
    select: { id: true },
  });
  if (!group) return NextResponse.json({ error: "Nhóm không còn tồn tại." }, { status: 404 });

  const pages = await prisma.page.count({ where: { groupId: id } });
  if (pages > 0) {
    return NextResponse.json(
      { error: `Nhóm còn ${pages} page. Chuyển các page sang nhóm khác trước khi xóa.` },
      { status: 409 },
    );
  }

  try {
    // sub-group xóa theo (cascade)
    const done = await prisma.group.deleteMany({ where: { id, ...scopeWhere(auth.scope) } });
    if (!done.count) {
      return NextResponse.json({ error: "Nhóm không còn tồn tại." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e, "Không xóa được nhóm.");
  }
}
