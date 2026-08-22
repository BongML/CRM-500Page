import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshNiches } from "@/lib/aggregate";
import { requireScope, scopeWhere } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Thao tác hàng loạt trên page đã chọn: gán ngách và/hoặc chuyển nhóm.
 * Body: { ids: string[], nicheId?: string, groupId?: string, subId?: string }
 *
 * Ngách/sub-group đích quyết định chủ sở hữu: chỉ những page cùng chủ với đích
 * mới được đổi. Nhờ vậy tài khoản tổng có thể tick page của nhiều người rồi gán
 * một lần mà không trộn dữ liệu giữa các tài khoản (số page bỏ qua trả về ở
 * `skipped` để giao diện báo lại).
 */
export async function POST(req: Request) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;
  const where = scopeWhere(auth.scope);

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
  /** Chủ sở hữu suy ra từ đích — mọi thao tác ghi bị khóa trong không gian này. */
  let owner: string | null = null;

  if (nicheId) {
    const niche = await prisma.niche.findFirst({ where: { id: nicheId, ...where } });
    if (!niche) return NextResponse.json({ error: "Ngách không tồn tại." }, { status: 400 });
    data.nicheId = nicheId;
    owner = niche.userId;
  }

  // Chuyển nhóm luôn đi theo cặp group + sub để dữ liệu không lệch.
  if (subId) {
    const sub = await prisma.subGroup.findFirst({ where: { id: subId, ...where } });
    if (!sub) return NextResponse.json({ error: "Sub-group không tồn tại." }, { status: 400 });
    if (groupId && sub.groupId !== groupId) {
      return NextResponse.json({ error: "Sub-group không thuộc nhóm đã chọn." }, { status: 400 });
    }
    if (owner && sub.userId !== owner) {
      return NextResponse.json(
        { error: "Ngách và nhóm đích thuộc hai tài khoản khác nhau." },
        { status: 400 },
      );
    }
    data.subId = sub.id;
    data.groupId = sub.groupId;
    owner = sub.userId;
  } else if (groupId) {
    return NextResponse.json({ error: "Chọn sub-group đích để chuyển nhóm." }, { status: 400 });
  }

  if (Object.keys(data).length === 0 || !owner) {
    return NextResponse.json({ error: "Không có thay đổi nào." }, { status: 400 });
  }

  // Ngách nguồn phải được tính lại cùng ngách đích, nên lấy trước khi ghi.
  const before = await prisma.page.findMany({
    where: { id: { in: ids }, userId: owner },
    select: { nicheId: true },
  });

  const res = await prisma.page.updateMany({ where: { id: { in: ids }, userId: owner }, data });

  if (data.nicheId) await refreshNiches([...before.map((p) => p.nicheId), data.nicheId]);

  return NextResponse.json({ updated: res.count, skipped: ids.length - res.count });
}

/**
 * Xóa hẳn nhiều page khỏi hệ thống. Body: { ids: string[] }
 *
 * Xóa kèm luôn top content của chính các page đó: giữ lại thì bài viết thành mồ
 * côi (pageId null) và vẫn nằm trong số liệu của ngách dù page đã biến mất.
 * Không đụng tới nhóm/sub-group — nhóm rỗng vẫn giữ nguyên để xếp lại sau.
 */
export async function DELETE(req: Request) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;

  const { ids } = (await req.json().catch(() => ({}))) as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Chưa chọn page nào." }, { status: 400 });
  }

  // Lọc theo phạm vi trước: người dùng thường chỉ chạm được page của mình.
  const mine = await prisma.page.findMany({
    where: { id: { in: ids }, ...scopeWhere(auth.scope) },
    select: { id: true, nicheId: true },
  });
  if (!mine.length) {
    return NextResponse.json({ error: "Không tìm thấy page nào để xóa." }, { status: 404 });
  }

  const pageIds = mine.map((p) => p.id);
  // pageId là khóa chính toàn cục nên không cần lọc thêm theo chủ sở hữu.
  const posts = await prisma.topPost.deleteMany({ where: { pageId: { in: pageIds } } });
  const deleted = await prisma.page.deleteMany({ where: { id: { in: pageIds } } });

  // Ngách của các page vừa xóa phải tính lại, nếu không dashboard treo số cũ.
  await refreshNiches(mine.map((p) => p.nicheId));

  return NextResponse.json({ deleted: deleted.count, posts: posts.count });
}
