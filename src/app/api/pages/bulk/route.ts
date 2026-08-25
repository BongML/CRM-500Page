import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { refreshNiches } from "@/lib/aggregate";
import { runBatch } from "@/lib/batch";
import { cleanNiches } from "@/lib/niche";
import { requireScope, scopeWhere } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Cách áp tập ngách lên page đã chọn. */
type NicheMode = "set" | "add" | "remove";

/**
 * Thao tác hàng loạt trên page đã chọn: gán ngách và/hoặc chuyển nhóm.
 * Body: { ids: string[], nicheIds?: string[], nicheMode?, groupId?, subId? }
 *
 * `nicheMode` quyết định ý nghĩa của `nicheIds` — một page giữ nhiều ngách nên
 * "gán" không còn hiển nhiên là thay thế:
 *   set    — thay trọn tập ngách của page (mặc định)
 *   add    — thêm vào tập đang có, giữ nguyên ngách cũ
 *   remove — gỡ các ngách này khỏi page
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

  const body = (await req.json()) as {
    ids?: string[];
    nicheIds?: string[];
    nicheMode?: NicheMode;
    groupId?: string;
    subId?: string;
  };
  const { ids, groupId, subId } = body;
  const nicheIds = Array.isArray(body.nicheIds) ? cleanNiches(body.nicheIds) : null;
  const nicheMode: NicheMode = body.nicheMode ?? "set";

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Chưa chọn page nào." }, { status: 400 });
  }

  const move: { groupId?: string; subId?: string } = {};
  /** Chủ sở hữu suy ra từ đích — mọi thao tác ghi bị khóa trong không gian này. */
  let owner: string | null = null;

  if (nicheIds?.length) {
    const found = await prisma.niche.findMany({
      where: { id: { in: nicheIds }, ...where },
      select: { id: true, userId: true },
    });
    if (found.length !== nicheIds.length) {
      return NextResponse.json({ error: "Ngách không tồn tại." }, { status: 400 });
    }
    const owners = new Set(found.map((n) => n.userId));
    if (owners.size > 1) {
      return NextResponse.json(
        { error: "Các ngách đã chọn thuộc nhiều tài khoản khác nhau." },
        { status: 400 },
      );
    }
    owner = found[0].userId;
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
    move.subId = sub.id;
    move.groupId = sub.groupId;
    owner = sub.userId;
  } else if (groupId) {
    return NextResponse.json({ error: "Chọn sub-group đích để chuyển nhóm." }, { status: 400 });
  }

  // Gỡ sạch ngách (mảng rỗng) không có đích nào để suy ra chủ sở hữu, nên lô đó
  // rơi về đúng phạm vi của phiên thay vì phạm vi của ngách đích.
  const touchesNiche = nicheIds !== null;
  if (!touchesNiche && !move.subId) {
    return NextResponse.json({ error: "Không có thay đổi nào." }, { status: 400 });
  }

  /** Page thật sự được phép chạm tới — kèm ngách cũ để tính lại số tổng hợp. */
  const before = await prisma.page.findMany({
    where: { id: { in: ids }, ...(owner ? { userId: owner } : where) },
    select: { id: true, nicheIds: true },
  });

  let updated = 0;
  const touched = new Set<string>();

  if (touchesNiche) {
    // "set" là một lệnh ghi cho cả lô; "add"/"remove" phải tính theo từng page
    // vì tập ngách cũ mỗi page một khác.
    if (nicheMode === "set" && !move.subId) {
      const res = await prisma.page.updateMany({
        where: { id: { in: before.map((p) => p.id) } },
        data: { nicheIds: nicheIds ?? [] },
      });
      updated = res.count;
    } else {
      await runBatch(
        before.map((p) =>
          prisma.page.update({
            where: { id: p.id },
            data: { ...move, nicheIds: applyNiches(p.nicheIds, nicheIds ?? [], nicheMode) },
          }),
        ),
      );
      updated = before.length;
    }

    for (const p of before) {
      for (const id of p.nicheIds) touched.add(id);
      for (const id of applyNiches(p.nicheIds, nicheIds ?? [], nicheMode)) touched.add(id);
    }
  } else {
    const res = await prisma.page.updateMany({
      where: { id: { in: before.map((p) => p.id) } },
      data: move,
    });
    updated = res.count;
  }

  if (touched.size) await refreshNiches(touched);

  return NextResponse.json({ updated, skipped: ids.length - updated });
}

/** Tập ngách mới của một page sau khi áp `mode`. Thứ tự cũ được giữ nguyên. */
function applyNiches(current: string[], picked: string[], mode: NicheMode): string[] {
  if (mode === "set") return picked;
  if (mode === "remove") {
    const drop = new Set(picked);
    return current.filter((id) => !drop.has(id));
  }
  return [...new Set([...current, ...picked])];
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
    select: { id: true, nicheIds: true },
  });
  if (!mine.length) {
    return NextResponse.json({ error: "Không tìm thấy page nào để xóa." }, { status: 404 });
  }

  const pageIds = mine.map((p) => p.id);
  // pageId là khóa chính toàn cục nên không cần lọc thêm theo chủ sở hữu.
  const posts = await prisma.topPost.deleteMany({ where: { pageId: { in: pageIds } } });
  const deleted = await prisma.page.deleteMany({ where: { id: { in: pageIds } } });

  // Ngách của các page vừa xóa phải tính lại, nếu không dashboard treo số cũ.
  await refreshNiches(mine.flatMap((p) => p.nicheIds));

  return NextResponse.json({ deleted: deleted.count, posts: posts.count });
}
