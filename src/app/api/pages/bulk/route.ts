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

/**
 * Xóa hẳn nhiều page khỏi hệ thống. Body: { ids: string[] }
 *
 * Xóa kèm luôn top content của chính các page đó: giữ lại thì bài viết thành mồ
 * côi (pageId null) và vẫn nằm trong số liệu của ngách dù page đã biến mất.
 * Không đụng tới nhóm/sub-group — nhóm rỗng vẫn giữ nguyên để xếp lại sau.
 */
export async function DELETE(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { userId } = auth;

  const { ids } = (await req.json().catch(() => ({}))) as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Chưa chọn page nào." }, { status: 400 });
  }

  // Lọc qua userId trước: chỉ xóa page của chính tài khoản đang đăng nhập.
  const mine = await prisma.page.findMany({
    where: { id: { in: ids }, userId },
    select: { id: true, nicheId: true },
  });
  if (!mine.length) {
    return NextResponse.json({ error: "Không tìm thấy page nào để xóa." }, { status: 404 });
  }

  const pageIds = mine.map((p) => p.id);
  const posts = await prisma.topPost.deleteMany({ where: { userId, pageId: { in: pageIds } } });
  const deleted = await prisma.page.deleteMany({ where: { id: { in: pageIds }, userId } });

  // Ngách của các page vừa xóa phải tính lại, nếu không dashboard treo số cũ.
  await refreshNiches(mine.map((p) => p.nicheId));

  return NextResponse.json({ deleted: deleted.count, posts: posts.count });
}
