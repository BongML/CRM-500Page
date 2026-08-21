import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

/**
 * Chép nguyên trạng dữ liệu đã dump từ SQLite sang DB đích (Neon Postgres).
 *
 *   npx tsx prisma/scripts/dump.ts dump.json          # đọc SQLite
 *   DATABASE_URL=<neon> npx tsx prisma/scripts/copy-to-postgres.ts dump.json
 *
 * Khác `restore.ts` (chỉ dùng một lần khi tách tài khoản): script này **giữ
 * nguyên mọi id, mọi userId và mật khẩu đã băm**, nên tài khoản đăng nhập y như
 * cũ. Chạy lại được: DB đích phải rỗng, nếu đã có dữ liệu thì dừng.
 */

type Row = Record<string, string | number | null>;

const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const req = (v: unknown) => String(v ?? "");
const int = (v: unknown) => Math.round(Number(v ?? 0));
const dec = (v: unknown) => Number(v ?? 0);
const when = (v: unknown) => (v ? new Date(String(v)) : null);

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Cú pháp: copy-to-postgres.ts <dump.json>");

  const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, Row[]>;
  const prisma = new PrismaClient();
  const rows = (table: string) => data[table] ?? [];

  const already = await prisma.user.count();
  if (already) throw new Error(`DB đích đã có ${already} tài khoản — dừng để không ghi đè.`);

  await prisma.user.createMany({
    data: rows("User").map((u) => ({
      id: req(u.id),
      email: req(u.email),
      name: req(u.name),
      password: req(u.password), // đã băm sẵn, chép nguyên
      createdAt: when(u.createdAt) ?? new Date(),
    })),
  });

  await prisma.niche.createMany({
    data: rows("Niche").map((n) => ({
      id: req(n.id),
      name: req(n.name),
      color: req(n.color),
      icon: req(n.icon),
      aggPages: int(n.aggPages),
      aggViews: int(n.aggViews),
      aggReach: int(n.aggReach),
      aggRate: dec(n.aggRate),
      aggPpi: int(n.aggPpi),
      order: int(n.order),
      userId: req(n.userId),
    })),
  });

  await prisma.group.createMany({
    data: rows("Group").map((g) => ({
      id: req(g.id),
      name: req(g.name),
      order: int(g.order),
      userId: req(g.userId),
    })),
  });

  await prisma.subGroup.createMany({
    data: rows("SubGroup").map((s) => ({
      id: req(s.id),
      name: req(s.name),
      order: int(s.order),
      groupId: req(s.groupId),
      userId: req(s.userId),
    })),
  });

  await prisma.page.createMany({
    data: rows("Page").map((p) => ({
      id: req(p.id),
      ref: req(p.ref),
      slug: req(p.slug),
      name: req(p.name),
      follower: int(p.follower),
      posts: int(p.posts),
      likes: int(p.likes),
      comments: int(p.comments),
      rate: dec(p.rate),
      ppi: int(p.ppi),
      views: int(p.views),
      reach: int(p.reach),
      network: str(p.network),
      url: str(p.url),
      reportedAt: when(p.reportedAt),
      source: str(p.source),
      groupId: req(p.groupId),
      subId: req(p.subId),
      nicheId: req(p.nicheId),
      userId: req(p.userId),
    })),
  });

  await prisma.topPost.createMany({
    data: rows("TopPost").map((t) => ({
      id: req(t.id),
      ref: req(t.ref),
      caption: req(t.caption),
      pageName: req(t.pageName),
      time: req(t.time),
      likes: int(t.likes),
      comments: int(t.comments),
      rcs: int(t.rcs),
      rate: dec(t.rate),
      reach: int(t.reach),
      ipi: dec(t.ipi),
      neg: dec(t.neg),
      link: str(t.link),
      image: str(t.image),
      order: int(t.order),
      pageRef: str(t.pageRef),
      pageSlug: str(t.pageSlug),
      nicheId: req(t.nicheId),
      pageId: str(t.pageId),
      userId: req(t.userId),
    })),
  });

  await prisma.trend.createMany({
    data: rows("Trend").map((t) => ({
      id: req(t.id),
      term: req(t.term),
      posts: int(t.posts),
      rate: req(t.rate),
      order: int(t.order),
      nicheId: req(t.nicheId),
      userId: req(t.userId),
    })),
  });

  await prisma.snapshot.createMany({
    data: rows("Snapshot").map((s) => ({
      id: req(s.id),
      takenAt: when(s.takenAt) ?? new Date(),
      pages: int(s.pages),
      views: int(s.views),
      reach: int(s.reach),
      rate: dec(s.rate),
      ppi: int(s.ppi),
      nicheId: str(s.nicheId),
      userId: req(s.userId),
    })),
  });

  // Đối chiếu từng bảng với file dump — lệch một dòng là biết ngay.
  const got: Record<string, number> = {
    User: await prisma.user.count(),
    Niche: await prisma.niche.count(),
    Group: await prisma.group.count(),
    SubGroup: await prisma.subGroup.count(),
    Page: await prisma.page.count(),
    TopPost: await prisma.topPost.count(),
    Trend: await prisma.trend.count(),
    Snapshot: await prisma.snapshot.count(),
  };

  let ok = true;
  for (const [table, count] of Object.entries(got)) {
    const want = rows(table).length;
    if (count !== want) ok = false;
    console.log(`${table.padEnd(9)} nguon ${String(want).padStart(4)} -> dich ${String(count).padStart(4)} ${count === want ? "OK" : "LECH"}`);
  }

  await prisma.$disconnect();
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
