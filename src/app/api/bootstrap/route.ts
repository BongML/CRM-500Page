import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Số điểm tối đa vẽ lên biểu đồ tăng trưởng (mỗi lần nhập báo cáo = 1 điểm). */
const SNAPSHOT_WINDOW = 60;

/** Toàn bộ dữ liệu app cần trong 1 lần gọi — chỉ của chính tài khoản đang đăng nhập. */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const where = { userId: auth.userId };

  const [niches, groups, subs, pages, topPosts, trends, snapshots] = await Promise.all([
    prisma.niche.findMany({ where, orderBy: { order: "asc" } }),
    prisma.group.findMany({ where, orderBy: { order: "asc" } }),
    prisma.subGroup.findMany({ where, orderBy: [{ groupId: "asc" }, { order: "asc" }] }),
    prisma.page.findMany({ where }),
    prisma.topPost.findMany({ where, orderBy: { order: "asc" } }),
    prisma.trend.findMany({ where, orderBy: [{ nicheId: "asc" }, { order: "asc" }] }),
    prisma.snapshot.findMany({ where, orderBy: { takenAt: "desc" }, take: SNAPSHOT_WINDOW }),
  ]);

  return NextResponse.json({
    niches,
    groups,
    subs,
    pages,
    topPosts,
    trends,
    // Trả về theo thứ tự thời gian tăng dần cho biểu đồ.
    snapshots: snapshots.reverse(),
    negThreshold: Number(process.env.CRM_NEG_THRESHOLD ?? 5),
  });
}
