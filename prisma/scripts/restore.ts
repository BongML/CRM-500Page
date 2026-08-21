import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { hashPassword, newId } from "../../src/lib/auth";

/**
 * Nạp lại dữ liệu đã dump vào schema đa người dùng, gán toàn bộ cho **một tài
 * khoản chủ**. Dùng đúng một lần khi chuyển hệ thống một-người sang nhiều-người.
 *
 * Chạy: npx tsx prisma/scripts/restore.ts <dump.json> <email> <mật khẩu>
 *
 * `id` cũ được giữ nguyên (chúng vẫn là duy nhất), chỉ thêm `userId` và `ref`:
 * ref = Profile-ID / Message-ID chính là id cũ, nên báo cáo nhập sau vẫn ghép
 * đúng vào page cũ.
 */

type Row = Record<string, string | number | null>;

const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const req = (v: unknown) => String(v ?? "");
const int = (v: unknown) => Math.round(Number(v ?? 0));
const dec = (v: unknown) => Number(v ?? 0);
const when = (v: unknown) => (v ? new Date(String(v)) : null);

async function main() {
  const [file, email, password] = process.argv.slice(2);
  if (!file || !email || !password) {
    throw new Error("Cú pháp: restore.ts <dump.json> <email> <mật khẩu>");
  }

  const data = JSON.parse(readFileSync(file, "utf8")) as Record<string, Row[]>;
  const prisma = new PrismaClient();

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw new Error(`Đã có tài khoản ${email} — dừng để không ghi đè.`);

  const user = await prisma.user.create({
    data: {
      id: newId(),
      email: email.toLowerCase(),
      name: email.split("@")[0],
      password: hashPassword(password),
    },
  });
  const userId = user.id;
  console.log("Tai khoan chu:", user.email, `(${userId})`);

  const rows = (table: string) => data[table] ?? [];

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
      userId,
    })),
  });

  await prisma.group.createMany({
    data: rows("Group").map((g) => ({
      id: req(g.id),
      name: req(g.name),
      order: int(g.order),
      userId,
    })),
  });

  await prisma.subGroup.createMany({
    data: rows("SubGroup").map((s) => ({
      id: req(s.id),
      name: req(s.name),
      order: int(s.order),
      groupId: req(s.groupId),
      userId,
    })),
  });

  await prisma.page.createMany({
    data: rows("Page").map((p) => ({
      id: req(p.id),
      ref: req(p.id), // id cũ chính là Profile-ID
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
      userId,
    })),
  });

  await prisma.topPost.createMany({
    data: rows("TopPost").map((t) => ({
      id: req(t.id),
      ref: req(t.id), // id cũ chính là Message-ID
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
      userId,
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
      userId,
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
      userId,
    })),
  });

  const counts = {
    niche: await prisma.niche.count(),
    group: await prisma.group.count(),
    sub: await prisma.subGroup.count(),
    page: await prisma.page.count(),
    post: await prisma.topPost.count(),
    trend: await prisma.trend.count(),
    snapshot: await prisma.snapshot.count(),
  };
  console.log("Da nap:", counts);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
