import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mergeSnapshots } from "@/lib/series";
import { requireScope, scopeWhere } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Số điểm tối đa vẽ lên biểu đồ tăng trưởng (mỗi lần nhập báo cáo = 1 điểm). */
const SNAPSHOT_WINDOW = 60;

/**
 * Toàn bộ dữ liệu app cần trong 1 lần gọi.
 *
 * Phạm vi do `requireScope` quyết định: người dùng thường chỉ thấy dữ liệu của
 * mình; tài khoản tổng ở chế độ "toàn hệ thống" nhận dữ liệu gộp của mọi tài
 * khoản (A 200 + B 500 + C 300 = 1000 page) kèm danh sách chủ sở hữu để giao
 * diện chú thích page nào của ai.
 */
export async function GET() {
  const auth = await requireScope();
  if (!auth.ok) return auth.response;

  const where = scopeWhere(auth.scope);
  const everyone = auth.scope.userId === null;

  const [niches, groups, subs, pages, topPosts, trends, snapshots, owners] = await Promise.all([
    prisma.niche.findMany({ where, orderBy: { order: "asc" } }),
    prisma.group.findMany({ where, orderBy: { order: "asc" } }),
    prisma.subGroup.findMany({ where, orderBy: [{ groupId: "asc" }, { order: "asc" }] }),
    prisma.page.findMany({ where }),
    prisma.topPost.findMany({ where, orderBy: { order: "asc" } }),
    prisma.trend.findMany({ where, orderBy: [{ nicheId: "asc" }, { order: "asc" }] }),
    // Toàn hệ thống thì snapshot của nhiều tài khoản trùng ngày nhau — lấy rộng
    // hơn rồi để client gộp theo mốc thời gian.
    prisma.snapshot.findMany({
      where,
      orderBy: { takenAt: "desc" },
      take: everyone ? SNAPSHOT_WINDOW * 10 : SNAPSHOT_WINDOW,
    }),
    everyone
      ? prisma.user.findMany({
          orderBy: { createdAt: "asc" },
          select: { id: true, name: true, email: true },
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    niches,
    groups,
    subs,
    pages,
    topPosts,
    trends,
    // Tăng dần theo thời gian, đã gộp các mốc trùng ngày của nhiều tài khoản.
    snapshots: mergeSnapshots(snapshots, SNAPSHOT_WINDOW),
    owners,
    scope: { admin: auth.scope.admin, userId: auth.scope.userId },
    negThreshold: Number(process.env.CRM_NEG_THRESHOLD ?? 5),
  });
}
