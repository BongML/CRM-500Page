import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshNiches } from "@/lib/aggregate";
import { requireScope, scopeWhere } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Xóa nhiều nhóm page cùng lúc. Body: { ids: string[], withPages?: boolean }
 *
 * Page bắt buộc phải thuộc một nhóm (khóa ngoại không cho null), nên nhóm còn
 * page thì chỉ có hai đường: xóa luôn page bên trong, hoặc chuyển chúng đi trước.
 * Mặc định route **từ chối** và trả về số page sẽ mất, để giao diện hỏi lại người
 * dùng bằng con số cụ thể; chỉ khi `withPages` được bật mới thực sự xóa.
 *
 * Sub-group của nhóm bị xóa theo (cascade ở tầng DB), top content của page bị xóa
 * cũng bị dọn để không còn bài mồ côi vẫn tính vào số liệu ngách.
 */
export async function DELETE(req: Request) {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;
  const where = scopeWhere(auth.scope);

  const { ids, withPages } = (await req.json().catch(() => ({}))) as {
    ids?: string[];
    withPages?: boolean;
  };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Chưa chọn nhóm nào." }, { status: 400 });
  }

  // Lọc theo phạm vi trước: không đụng được nhóm ngoài tầm dù biết id.
  const mine = await prisma.group.findMany({
    where: { id: { in: ids }, ...where },
    select: { id: true, name: true },
  });
  if (!mine.length) {
    return NextResponse.json({ error: "Không tìm thấy nhóm nào để xóa." }, { status: 404 });
  }

  const groupIds = mine.map((g) => g.id);
  // groupId là khóa chính toàn cục nên lọc theo nhóm là đủ.
  const inside = await prisma.page.findMany({
    where: { groupId: { in: groupIds } },
    select: { id: true, nicheIds: true },
  });

  if (inside.length && !withPages) {
    return NextResponse.json(
      {
        error: `${mine.length} nhóm này còn ${inside.length} page. Chuyển page đi trước, hoặc xác nhận xóa cả page.`,
        groups: mine.length,
        pages: inside.length,
      },
      { status: 409 },
    );
  }

  let posts = 0;
  if (inside.length) {
    const pageIds = inside.map((p) => p.id);
    posts = (await prisma.topPost.deleteMany({ where: { pageId: { in: pageIds } } })).count;
    await prisma.page.deleteMany({ where: { id: { in: pageIds } } });
  }

  await prisma.subGroup.deleteMany({ where: { groupId: { in: groupIds } } });
  const deleted = await prisma.group.deleteMany({ where: { id: { in: groupIds } } });

  // Ngách của các page vừa mất phải tính lại, nếu không dashboard treo số cũ.
  if (inside.length) await refreshNiches(inside.flatMap((p) => p.nicheIds));

  return NextResponse.json({ deleted: deleted.count, pages: inside.length, posts });
}
