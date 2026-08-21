import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Tạo sub-group trong 1 nhóm. Body: { groupId, name? } */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { userId } = auth;

  const { groupId, name } = (await req.json()) as { groupId?: string; name?: string };
  if (!groupId) return NextResponse.json({ error: "Thiếu nhóm cha." }, { status: 400 });

  const group = await prisma.group.findFirst({ where: { id: groupId, userId } });
  if (!group) return NextResponse.json({ error: "Nhóm không tồn tại." }, { status: 400 });

  const order = await prisma.subGroup.count({ where: { groupId } });
  const label = (name ?? "").trim() || `Sub-group ${String.fromCharCode(65 + order)}`;

  const sub = await prisma.subGroup.create({
    data: { id: `${groupId}-s${Date.now().toString(36)}`, name: label, groupId, order, userId },
  });

  return NextResponse.json(sub);
}
