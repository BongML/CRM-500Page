import { prisma } from "@/lib/prisma";
import CrmApp from "@/components/CrmApp";
import { currentUserId } from "@/lib/session";
import type { Bootstrap } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Số điểm tối đa vẽ lên biểu đồ tăng trưởng (mỗi lần nhập báo cáo = 1 điểm). */
const SNAPSHOT_WINDOW = 60;

const EMPTY: Omit<Bootstrap, "negThreshold"> = {
  niches: [],
  groups: [],
  subs: [],
  pages: [],
  topPosts: [],
  trends: [],
  snapshots: [],
};

/**
 * Nạp dữ liệu của **chính tài khoản đang đăng nhập** ở server rồi giao cho SPA.
 * Chưa đăng nhập thì render rỗng — client sẽ hiện màn đăng nhập và tự nạp lại
 * sau khi vào được.
 */
async function load(): Promise<Bootstrap> {
  const negThreshold = Number(process.env.CRM_NEG_THRESHOLD ?? 5);
  const userId = await currentUserId();
  if (!userId) return { ...EMPTY, negThreshold };

  const where = { userId };

  const [niches, groups, subs, pages, topPosts, trends, snapshots] = await Promise.all([
    prisma.niche.findMany({ where, orderBy: { order: "asc" } }),
    prisma.group.findMany({ where, orderBy: { order: "asc" } }),
    prisma.subGroup.findMany({ where, orderBy: [{ groupId: "asc" }, { order: "asc" }] }),
    prisma.page.findMany({ where }),
    prisma.topPost.findMany({ where, orderBy: { order: "asc" } }),
    prisma.trend.findMany({ where, orderBy: [{ nicheId: "asc" }, { order: "asc" }] }),
    prisma.snapshot.findMany({ where, orderBy: { takenAt: "desc" }, take: SNAPSHOT_WINDOW }),
  ]);

  return {
    niches,
    groups,
    subs,
    pages: pages.map((p) => ({ ...p, reportedAt: p.reportedAt?.toISOString() ?? null })),
    topPosts,
    trends,
    snapshots: snapshots.reverse().map((s) => ({ ...s, takenAt: s.takenAt.toISOString() })),
    negThreshold,
  };
}

export default async function Home() {
  return <CrmApp initial={await load()} />;
}
