import { prisma } from "./prisma";

/**
 * Số tổng hợp của ngách (cột agg*) luôn được tính lại từ chính các Page đang
 * thuộc ngách — không có nguồn nào khác. Mọi thao tác làm page đổi ngách, bị
 * xóa hoặc được nhập lại đều phải gọi refreshNiches cho các ngách liên quan,
 * nếu không dashboard sẽ treo số của lần trước.
 *
 * Phép tính chạy **trong DB** (`aggregate`) chứ không kéo toàn bộ page về rồi
 * cộng ở Node: một ngách 500 page mà tải hết rows về thì mỗi lần nhập báo cáo
 * phải chuyển hàng trăm KB qua mạng, đủ để chạm trần thời gian chạy hàm.
 */
export async function refreshNiches(nicheIds: Iterable<string>) {
  for (const id of new Set(nicheIds)) {
    const agg = await prisma.page.aggregate({
      where: { nicheId: id },
      _count: { _all: true },
      _sum: { views: true, reach: true },
      _avg: { rate: true, ppi: true },
    });

    await prisma.niche
      .update({
        where: { id },
        data: {
          aggPages: agg._count._all,
          aggViews: agg._sum.views ?? 0,
          aggReach: agg._sum.reach ?? 0,
          aggRate: agg._avg.rate ? +agg._avg.rate.toFixed(2) : 0,
          aggPpi: agg._avg.ppi ? Math.round(agg._avg.ppi) : 0,
        },
      })
      // Ngách có thể vừa bị xóa ở phiên khác — không cần dựng lại.
      .catch(() => undefined);
  }
}

/** Tính lại toàn bộ ngách (dùng sau thao tác hàng loạt không rõ phạm vi). */
export async function refreshAllNiches() {
  const niches = await prisma.niche.findMany({ select: { id: true } });
  await refreshNiches(niches.map((n) => n.id));
}
