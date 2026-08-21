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
