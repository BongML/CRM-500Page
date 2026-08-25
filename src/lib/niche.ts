import { prisma } from "./prisma";

/**
 * Ngách mặc định cho page mới của **một tài khoản**. Ưu tiên ngách được chỉ
 * định; không có (hoặc không thuộc tài khoản này) thì rơi về "Chưa phân loại" —
 * tự tạo ở lần cần đầu tiên.
 *
 * Trả về một hàm nhớ kết quả: cả lô nhập / lô phân loại chỉ tra một lần, và
 * không tạo ngách rác khi thật ra chẳng có page mới nào.
 */
export function nicheResolver(userId: string, preferred: string | null) {
  let cached: string | null = null;
  // Id cố định theo tài khoản: mỗi người có "Chưa phân loại" của riêng mình.
  const fallbackId = `${userId}-unassigned`;

  return async function resolve(): Promise<string> {
    if (cached) return cached;

    if (preferred) {
      const found = await prisma.niche.findFirst({ where: { id: preferred, userId } });
      if (found) return (cached = found.id);
    }

    const existing = await prisma.niche.findUnique({ where: { id: fallbackId } });
    if (existing) return (cached = existing.id);

    const last = await prisma.niche.findFirst({ where: { userId }, orderBy: { order: "desc" } });
    const created = await prisma.niche.create({
      data: {
        id: fallbackId,
        name: "Chưa phân loại",
        color: "#64748b",
        icon: "?",
        order: (last?.order ?? -1) + 1,
        userId,
      },
    });
    return (cached = created.id);
  };
}

/** Bỏ id rỗng/trùng, giữ nguyên thứ tự chọn — phần tử đầu là ngách chính. */
export const cleanNiches = (ids: readonly string[]): string[] =>
  [...new Set(ids.map((s) => String(s ?? "").trim()).filter(Boolean))];

/**
 * Lọc danh sách ngách người dùng gửi lên, chỉ giữ những ngách **có thật và
 * thuộc đúng tài khoản** đó — không có đường nào gán page của A vào ngách của B.
 * Thứ tự người dùng chọn được giữ nguyên vì phần tử đầu là ngách chính.
 */
export async function ownedNiches(userId: string, ids: readonly string[]): Promise<string[]> {
  const wanted = cleanNiches(ids);
  if (!wanted.length) return [];

  const found = await prisma.niche.findMany({
    where: { id: { in: wanted }, userId },
    select: { id: true },
  });
  const ok = new Set(found.map((n) => n.id));
  return wanted.filter((id) => ok.has(id));
}
