import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshNiches } from "@/lib/aggregate";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Thao tác hàng loạt trên page đã chọn: gán ngách và/hoặc chuyển nhóm.
 * Body: { ids: string[], nicheId?: string, groupId?: string, subId?: string }
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { userId } = auth;

  const { ids, nicheId, groupId, subId } = (await req.json()) as {
    ids?: string[];
    nicheId?: string;
    groupId?: string;
    subId?: string;
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Chưa chọn page nào." }, { status: 400 });
  }

  const data: { nicheId?: string; groupId?: string; subId?: string } = {};

  if (nicheId) {
    const niche = await prisma.niche.findFirst({ where: { id: nicheId, userId } });
    if (!niche) return NextResponse.json({ error: "Ngách không tồn tại." }, { status: 400 });
    data.nicheId = nicheId;
  }

  // Chuyển nhóm luôn đi theo cặp group + sub để dữ liệu không lệch.
  if (subId) {
    const sub = await prisma.subGroup.findFirst({ where: { id: subId, userId } });
    if (!sub) return NextResponse.json({ error: "Sub-group không tồn tại." }, { status: 400 });
    if (groupId && sub.groupId !== groupId) {
      return NextResponse.json({ error: "Sub-group không thuộc nhóm đã chọn." }, { status: 400 });
    }
    data.subId = sub.id;
    data.groupId = sub.groupId;
  } else if (groupId) {
    return NextResponse.json({ error: "Chọn sub-group đích để chuyển nhóm." }, { status: 400 });
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Không có thay đổi nào." }, { status: 400 });
  }

  // Ngách nguồn phải được tính lại cùng ngách đích, nên lấy trước khi ghi.
  const before = await prisma.page.findMany({
    where: { id: { in: ids }, userId },
    select: { nicheId: true },
  });

  const res = await prisma.page.updateMany({ where: { id: { in: ids }, userId }, data });

  if (data.nicheId) await refreshNiches([...before.map((p) => p.nicheId), data.nicheId]);

  return NextResponse.json({ updated: res.count });
}
