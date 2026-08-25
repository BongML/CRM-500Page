import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runBatch } from "@/lib/batch";
import { newId } from "@/lib/auth";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Tạo ngách mới + gán các page đã chọn vào ngách đó.
 * Các cột agg* tính từ chính tập page được gán; ngách rỗng bắt đầu từ 0.
 * Body: { name, color, pageIds: string[] }
 *
 * Page **giữ nguyên** các ngách đang có: ngách mới được thêm vào tập của page
 * chứ không thay chỗ, nên các ngách cũ không đổi số và không cần tính lại.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const { userId } = auth;

  const { name, color, pageIds } = (await req.json()) as {
    name?: string;
    color?: string;
    pageIds?: string[];
  };

  const label = (name ?? "").trim() || "Ngách mới";
  if (!color) return NextResponse.json({ error: "Thiếu màu ngách." }, { status: 400 });

  const ids = Array.isArray(pageIds) ? pageIds : [];
  const picked = ids.length
    ? await prisma.page.findMany({ where: { id: { in: ids }, userId } })
    : [];

  const id = newId();
  const last = await prisma.niche.findFirst({ where: { userId }, orderBy: { order: "desc" } });

  const niche = await prisma.niche.create({
    data: {
      id,
      name: label,
      color,
      icon: label[0].toUpperCase(),
      order: (last?.order ?? -1) + 1,
      userId,
      aggPages: picked.length,
      aggViews: picked.reduce((a, p) => a + p.views, 0),
      aggReach: picked.reduce((a, p) => a + p.reach, 0),
      aggRate: picked.length
        ? +(picked.reduce((a, p) => a + p.rate, 0) / picked.length).toFixed(2)
        : 0,
      aggPpi: picked.length
        ? Math.round(picked.reduce((a, p) => a + p.ppi, 0) / picked.length)
        : 0,
    },
  });

  // Mỗi page một tập ngách khác nhau nên phải ghi từng dòng, gộp lại thành ít
  // vòng đi-về nhất có thể.
  await runBatch(
    picked
      .filter((p) => !p.nicheIds.includes(id))
      .map((p) =>
        prisma.page.update({ where: { id: p.id }, data: { nicheIds: [...p.nicheIds, id] } }),
      ),
  );

  return NextResponse.json(await prisma.niche.findUniqueOrThrow({ where: { id } }));
}
