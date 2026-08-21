import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { newId } from "@/lib/auth";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Tạo nhóm page mới (kèm 1 sub-group mặc định). Body: { name? } */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { userId } = auth;

  const { name } = (await req.json().catch(() => ({}))) as { name?: string };

  const last = await prisma.group.findFirst({ where: { userId }, orderBy: { order: "desc" } });
  const order = (last?.order ?? -1) + 1;
  const label = (name ?? "").trim() || `Nhóm ${String(order + 1).padStart(2, "0")}`;
  const id = newId();

  const group = await prisma.group.create({
    data: {
      id,
      name: label,
      order,
      userId,
      subs: { create: { id: `${id}-s1`, name: "Sub-group A", order: 0, userId } },
    },
    include: { subs: true },
  });

  return NextResponse.json(group);
}
