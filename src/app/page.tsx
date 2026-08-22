import { prisma } from "@/lib/prisma";
import CrmApp from "@/components/CrmApp";
import { mergeSnapshots } from "@/lib/series";
import { currentScope, scopeWhere } from "@/lib/session";
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
  owners: [],
  scope: { admin: false, userId: null },
};

/**
 * Nạp dữ liệu **đúng phạm vi của phiên** ở server rồi giao cho SPA: người dùng
 * thường thấy không gian của mình, tài khoản tổng thấy gộp cả hệ thống.
 * Chưa đăng nhập thì render rỗng — client sẽ hiện màn đăng nhập và tự nạp lại
 * sau khi vào được.
 */
async function load(): Promise<Bootstrap> {
  const negThreshold = Number(process.env.CRM_NEG_THRESHOLD ?? 5);
  const scope = await currentScope();
  if (!scope) return { ...EMPTY, negThreshold };

  const where = scopeWhere(scope);
  const everyone = scope.userId === null;

  const [niches, groups, subs, pages, topPosts, trends, snapshots, owners] = await Promise.all([
    prisma.niche.findMany({ where, orderBy: { order: "asc" } }),
    prisma.group.findMany({ where, orderBy: { order: "asc" } }),
    prisma.subGroup.findMany({ where, orderBy: [{ groupId: "asc" }, { order: "asc" }] }),
    prisma.page.findMany({ where }),
    prisma.topPost.findMany({ where, orderBy: { order: "asc" } }),
    prisma.trend.findMany({ where, orderBy: [{ nicheId: "asc" }, { order: "asc" }] }),
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

  return {
    niches,
    groups,
    subs,
    pages: pages.map((p) => ({ ...p, reportedAt: p.reportedAt?.toISOString() ?? null })),
    topPosts,
    trends,
    snapshots: mergeSnapshots(snapshots, SNAPSHOT_WINDOW),
    owners,
    scope: { admin: scope.admin, userId: scope.userId },
    negThreshold,
  };
}

export default async function Home() {
  return <CrmApp initial={await load()} />;
}
