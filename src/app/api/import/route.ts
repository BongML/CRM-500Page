import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { refreshNiches } from "@/lib/aggregate";
import { requireUser } from "@/lib/session";
import { newId } from "@/lib/auth";
import { nicheResolver } from "@/lib/niche";
import { chunk, runBatch } from "@/lib/batch";
import { parseReport, type MetricsRow, type PostRow, type TrendRow } from "@/lib/karmar";
import {
  dedupePages,
  dedupePosts,
  nameClashes,
  type Batch,
  type DuplicateHit,
  type Merged,
  type NameClash,
} from "@/lib/dedupe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Nhập báo cáo .xlsx export từ Fanpage Karma. Mỗi file là báo cáo của một số
 * page; các file trong cùng lô thường chồng lấn nhau nên toàn bộ được đọc trước,
 * lọc trùng, rồi mới ghi xuống DB một lần.
 *
 *  - Báo cáo benchmark ("Metrics Overview")      → bảng Page (mặt số liệu);
 *  - Báo cáo top content ("Top 25 Posts Overview") → bảng TopPost + Trend (mặt nội dung).
 *
 * Hai loại báo cáo của cùng một list page ghép về đúng một Page nhờ Profile-ID,
 * nên nhập cả hai chỉ làm dày thêm dữ liệu chứ không nhân đôi page.
 *
 * Body: multipart/form-data
 *   files[]  — 1..n file .xlsx
 *   nicheId  — ngách mặc định cho page mới ("" → tự tạo "Chưa phân loại")
 *   groupId  — nhóm đích cho page mới ("" → tự chia nhóm 25 page)
 *   subId    — sub-group đích, đi kèm groupId
 *   dryRun   — "1" để chỉ soát trùng, không ghi gì xuống DB
 */

const GROUP_CAP = 25;
const MB = 1024 * 1024;

/**
 * Trần dung lượng mỗi lần gọi. Đây là giới hạn của **nền tảng**, không phải của
 * bộ đọc: hàm serverless trên Vercel chặn body request quá ~4.5MB trước khi code
 * kịp chạy, nên ở đó phải tự chặn sớm để báo lỗi tiếng Việt thay vì 413 trống.
 * Chạy ở máy nhà hoặc server thường thì không có giới hạn đó, và báo cáo Karmar
 * thật nặng 3–6MB mỗi file nên trần 4MB sẽ làm tính năng vô dụng.
 *
 * Đặt CRM_MAX_UPLOAD_MB để chỉnh tay (ví dụ khi dùng nền tảng khác).
 */
const CONFIGURED_MB = Number(process.env.CRM_MAX_UPLOAD_MB);
const LIMIT_MB =
  Number.isFinite(CONFIGURED_MB) && CONFIGURED_MB > 0 ? CONFIGURED_MB : process.env.VERCEL ? 4 : 25;

const MAX_FILE_BYTES = LIMIT_MB * MB;
/** Tổng dung lượng một lần gọi — client tự chia lô theo con số này (xem GET bên dưới). */
const MAX_TOTAL_BYTES = LIMIT_MB * MB;
const MAX_FILES = 20;
/** Số dòng trùng gửi kèm về client để hiển thị chi tiết. */
const DUPLICATE_SAMPLE = 60;
/** Số hashtag giữ lại cho mỗi ngách. */
const TRENDS_PER_NICHE = 8;

type Kind = "metrics" | "posts";

type FileResult = {
  file: string;
  kind: Kind | null;
  sheet: string | null;
  /** Kỳ báo cáo dạng ISO, dùng để chọn bản mới nhất khi trùng. */
  from: string | null;
  to: string | null;
  rows: number;
  error: string | null;
};

const two = (n: number) => String(n).padStart(2, "0");

/** Nhãn sub-group cho mỗi lần nhập: "Nhập 20/08 14:32". */
function batchLabel(now: Date): string {
  return `Nhập ${two(now.getDate())}/${two(now.getMonth() + 1)} ${two(now.getHours())}:${two(now.getMinutes())}`;
}

/**
 * Chỗ xếp page mới. Có groupId/subId thì dùng cố định; không thì lấp dần các
 * nhóm còn chỗ (tối đa 25 page/nhóm), mỗi nhóm mở 1 sub-group cho lần nhập này.
 */
async function placer(
  userId: string,
  fixed: { groupId: string; subId: string } | null,
  label: string,
) {
  if (fixed) return async () => fixed;

  const groups = await prisma.group.findMany({
    where: { userId },
    orderBy: { order: "asc" },
    include: { _count: { select: { pages: true } } },
  });

  const buckets = groups.map((g) => ({ id: g.id, order: g.order, count: g._count.pages }));
  const subOfGroup = new Map<string, string>();
  const stamp = Date.now().toString(36);
  let made = 0;

  return async function next(): Promise<{ groupId: string; subId: string }> {
    let bucket = buckets.find((b) => b.count < GROUP_CAP);

    if (!bucket) {
      const order = buckets.reduce((max, b) => Math.max(max, b.order + 1), 0);
      made++;
      const group = await prisma.group.create({
        data: { id: newId(), name: `Nhóm ${two(order + 1)}`, order, userId },
      });
      bucket = { id: group.id, order, count: 0 };
      buckets.push(bucket);
    }

    let subId = subOfGroup.get(bucket.id);
    if (!subId) {
      subId = `${bucket.id}-${stamp}`;
      const exists = await prisma.subGroup.findUnique({ where: { id: subId } });
      if (!exists) {
        const order = await prisma.subGroup.count({ where: { groupId: bucket.id } });
        await prisma.subGroup.create({
          data: { id: subId, name: label, groupId: bucket.id, order, userId },
        });
      }
      subOfGroup.set(bucket.id, subId);
    }

    bucket.count++;
    return { groupId: bucket.id, subId };
  };
}

/** Page đã có trong hệ thống, tra được theo Profile-ID lẫn theo tên chuẩn hóa. */
type KnownPage = { id: string; ref: string; slug: string; nicheId: string };

/**
 * Ảnh chụp bảng Page của một tài khoản. Cả lô nhập chỉ quét **một lần** rồi
 * chuyền tay nhau: mỗi lần quét là vài trăm dòng đi qua mạng, lặp lại 3–4 lần là
 * đủ làm một lần nhập chậm gấp mấy lần.
 */
type PageIndex = KnownPage;

const scanPages = (userId: string): Promise<PageIndex[]> =>
  prisma.page.findMany({
    where: { userId },
    select: { id: true, ref: true, slug: true, nicheId: true },
  });

async function loadKnownPages(userId: string) {
  const rows = await scanPages(userId);
  // Khóa tra là `ref` (Profile-ID trong báo cáo), không phải id nội bộ.
  const byId = new Map(rows.map((p) => [p.ref, p]));
  const bySlug = new Map<string, KnownPage>();
  // Tên trùng nhau giữa nhiều page cũ thì không dùng tên làm khóa nữa.
  const ambiguous = new Set<string>();

  for (const p of rows) {
    if (!p.slug) continue;
    if (bySlug.has(p.slug)) ambiguous.add(p.slug);
    bySlug.set(p.slug, p);
  }
  for (const slug of ambiguous) bySlug.delete(slug);

  return { byId, bySlug };
}

type PageOutcome = {
  created: number;
  updated: number;
  /** Page cũ được nhận ra nhờ tên (báo cáo trước thiếu Profile-ID). */
  matchedByName: number;
  /** nicheId của mọi ngách bị đụng tới, để tính lại số tổng hợp. */
  touched: Set<string>;
  /** Profile-ID trong báo cáo → id thật của page trong DB. */
  idMap: Map<string, string>;
  /** Tên chuẩn hóa → id thật của page trong DB. */
  slugMap: Map<string, string>;
};

/** Ghi các page đã lọc trùng xuống DB. */
async function writePages(
  userId: string,
  merged: Merged<MetricsRow>[],
  known: Awaited<ReturnType<typeof loadKnownPages>>,
  place: () => Promise<{ groupId: string; subId: string }>,
  defaultNiche: () => Promise<string>,
  dryRun: boolean,
): Promise<PageOutcome> {
  const out: PageOutcome = {
    created: 0,
    updated: 0,
    matchedByName: 0,
    touched: new Set<string>(),
    idMap: new Map(),
    slugMap: new Map(),
  };

  /** Lệnh cập nhật của từng page — gửi theo lô ở cuối, không từng dòng một. */
  const updates: Prisma.PrismaPromise<unknown>[] = [];
  const creates: Prisma.PageCreateManyInput[] = [];

  for (const item of merged) {
    const row = item.row;
    const existing = known.byId.get(row.id) ?? known.bySlug.get(row.slug);

    const metrics = {
      name: row.name,
      slug: row.slug,
      follower: row.follower,
      posts: row.posts,
      likes: row.likes,
      comments: row.comments,
      rate: row.rate,
      ppi: row.ppi,
      views: row.views,
      reach: row.reach,
      network: row.network,
      url: row.url,
      image: row.image,
      reportedAt: item.kept.reportedAt ? new Date(item.kept.reportedAt) : null,
      source: item.kept.file,
    };

    if (existing) {
      // Khớp bằng tên = báo cáo mang Profile-ID khác với ref đang lưu của page.
      if (existing.ref !== row.id) out.matchedByName++;
      if (!dryRun) updates.push(prisma.page.update({ where: { id: existing.id }, data: metrics }));
      out.touched.add(existing.nicheId);
      out.updated++;
      out.idMap.set(row.id, existing.id);
      out.slugMap.set(row.slug, existing.id);
      continue;
    }

    const nicheId = await defaultNiche();
    const pageId = newId();
    out.touched.add(nicheId);
    out.created++;
    out.idMap.set(row.id, pageId);
    out.slugMap.set(row.slug, pageId);

    if (!dryRun) {
      // `place()` chỉ chạm DB khi phải mở nhóm mới (tối đa 1 lần / 25 page).
      const spot = await place();
      creates.push({ id: pageId, ref: row.id, ...metrics, ...spot, nicheId, userId });
      // Page vừa tạo cũng là "đã biết" với các dòng sau trong cùng lô.
      const fresh = { id: pageId, ref: row.id, slug: row.slug, nicheId };
      known.byId.set(row.id, fresh);
      if (row.slug) known.bySlug.set(row.slug, fresh);
    }
  }

  await runBatch(updates);
  for (const part of chunk(creates)) {
    await prisma.page.createMany({ data: part, skipDuplicates: true });
  }

  return out;
}

type PostOutcome = { created: number; updated: number; linked: number };

/**
 * Ghi top content. Mỗi bài được nối về đúng Page qua Profile-ID (rơi về tên nếu
 * báo cáo thiếu ID) để trang chi tiết page hiển thị bài của chính page đó.
 */
async function writePosts(
  userId: string,
  /** Ảnh chụp bảng Page sau bước ghi page — dùng chung, không quét lại DB. */
  pages: PageIndex[],
  merged: Merged<PostRow>[],
  links: { idMap: Map<string, string>; slugMap: Map<string, string> },
  defaultNiche: () => Promise<string>,
  touched: Set<string>,
  dryRun: boolean,
): Promise<PostOutcome> {
  const nicheOfPage = new Map(pages.map((p) => [p.id, p.nicheId]));
  const idMap = new Map(links.idMap);
  const slugMap = new Map(links.slugMap);
  for (const p of pages) {
    if (!idMap.has(p.ref)) idMap.set(p.ref, p.id);
    if (p.slug && !slugMap.has(p.slug)) slugMap.set(p.slug, p.id);
  }

  // Bài đã có của chính tài khoản này, tra theo Message-ID trong báo cáo.
  const known = new Map(
    (
      await prisma.topPost.findMany({
        where: { userId, ref: { in: merged.map((m) => m.row.id) } },
        select: { id: true, ref: true },
      })
    ).map((p) => [p.ref, p.id]),
  );

  const out: PostOutcome = { created: 0, updated: 0, linked: 0 };
  const updates: Prisma.PrismaPromise<unknown>[] = [];
  const creates: Prisma.TopPostCreateManyInput[] = [];

  for (const item of merged) {
    const row = item.row;
    const pageId = idMap.get(row.pageId) ?? slugMap.get(row.pageSlug) ?? null;
    if (pageId) out.linked++;

    const nicheId = (pageId && nicheOfPage.get(pageId)) || (await defaultNiche());
    touched.add(nicheId);

    const existingId = known.get(row.id);
    if (existingId) out.updated++;
    else out.created++;

    if (dryRun) continue;

    const data = {
      caption: row.caption,
      pageName: row.pageName,
      time: row.time,
      likes: row.likes,
      comments: row.comments,
      rcs: row.rcs,
      rate: row.rate,
      reach: row.reach,
      ipi: row.ipi,
      neg: row.neg,
      link: row.link,
      image: row.image,
      pageRef: row.pageId || null,
      pageSlug: row.pageSlug || null,
      nicheId,
      pageId,
    };

    if (existingId) {
      updates.push(prisma.topPost.update({ where: { id: existingId }, data }));
    } else {
      creates.push({ id: newId(), ref: row.id, userId, ...data });
    }
  }

  await runBatch(updates);
  for (const part of chunk(creates)) {
    await prisma.topPost.createMany({ data: part, skipDuplicates: true });
  }

  return out;
}

/**
 * Nối lại các bài còn mồ côi. Báo cáo top content có thể được nhập trước báo
 * cáo benchmark, khi đó bài chưa tìm thấy Page nào; sau khi page được tạo thì
 * gắn lại theo Profile-ID (rơi về tên chuẩn hóa) để hai mặt dữ liệu khớp nhau
 * bất kể thứ tự nhập.
 */
async function relinkOrphanPosts(
  userId: string,
  pages: PageIndex[],
  touched: Set<string>,
): Promise<number> {
  const orphans = await prisma.topPost.findMany({
    where: { userId, pageId: null },
    select: { id: true, pageRef: true, pageSlug: true },
  });
  if (!orphans.length) return 0;

  const byId = new Map(pages.map((p) => [p.ref, p]));
  const bySlug = new Map(pages.map((p) => [p.slug, p]));

  const updates: Prisma.PrismaPromise<unknown>[] = [];
  let linked = 0;

  for (const post of orphans) {
    const page =
      (post.pageRef ? byId.get(post.pageRef) : undefined) ??
      (post.pageSlug ? bySlug.get(post.pageSlug) : undefined);
    if (!page) continue;

    updates.push(
      prisma.topPost.update({
        where: { id: post.id },
        data: { pageId: page.id, nicheId: page.nicheId },
      }),
    );
    touched.add(page.nicheId);
    linked++;
  }

  await runBatch(updates);
  return linked;
}

/** Xếp lại thứ tự top content theo tổng tương tác giảm dần. */
async function reorderPosts(userId: string) {
  const posts = await prisma.topPost.findMany({
    where: { userId },
    orderBy: [{ rcs: "desc" }, { rate: "desc" }],
    select: { id: true },
  });

  await runBatch(
    posts.map((p, i) => prisma.topPost.update({ where: { id: p.id }, data: { order: i } })),
  );
}

/**
 * Hashtag nổi bật của một báo cáo thuộc về ngách chiếm đa số trong chính list
 * page của báo cáo đó. Ghi đè trọn bộ hashtag của ngách để không tồn dư kỳ cũ.
 */
async function writeTrends(
  userId: string,
  byNiche: Map<string, TrendRow[]>,
  dryRun: boolean,
): Promise<number> {
  let total = 0;

  for (const [nicheId, rows] of byNiche) {
    const top = [...rows].sort((a, b) => b.posts - a.posts).slice(0, TRENDS_PER_NICHE);
    total += top.length;
    if (dryRun) continue;

    await prisma.trend.deleteMany({ where: { nicheId, userId } });
    await prisma.trend.createMany({
      data: top.map((t, i) => ({
        id: `tr_${nicheId}_${i}`,
        term: t.term,
        posts: t.posts,
        rate: t.rate,
        order: i,
        nicheId,
        userId,
      })),
    });
  }

  return total;
}

/**
 * Chốt một điểm cho biểu đồ tăng trưởng: số liệu toàn hệ và từng ngách tại mốc
 * cuối kỳ báo cáo. Id sinh theo (ngách, ngày) nên nhập lại cùng báo cáo chỉ ghi
 * đè, không tạo điểm trùng trên biểu đồ.
 */
async function writeSnapshot(userId: string, takenAt: Date) {
  const day = takenAt.toISOString().slice(0, 10);
  const niches = await prisma.niche.findMany({
    where: { userId },
    select: { id: true, aggPages: true, aggViews: true, aggReach: true, aggRate: true, aggPpi: true },
  });

  const scopes = [
    ...niches.map((n) => ({ nicheId: n.id, ...n })),
    {
      nicheId: null as string | null,
      aggPages: niches.reduce((a, n) => a + n.aggPages, 0),
      aggViews: niches.reduce((a, n) => a + n.aggViews, 0),
      aggReach: niches.reduce((a, n) => a + n.aggReach, 0),
      aggRate: 0,
      aggPpi: 0,
    },
  ];

  // Số toàn hệ là trung bình có trọng số theo số page của từng ngách.
  const all = scopes[scopes.length - 1];
  if (all.aggPages) {
    all.aggRate = +(niches.reduce((a, n) => a + n.aggRate * n.aggPages, 0) / all.aggPages).toFixed(2);
    all.aggPpi = Math.round(niches.reduce((a, n) => a + n.aggPpi * n.aggPages, 0) / all.aggPages);
  }

  for (const s of scopes) {
    const data = {
      takenAt,
      pages: s.aggPages,
      views: s.aggViews,
      reach: s.aggReach,
      rate: s.aggRate,
      ppi: s.aggPpi,
      nicheId: s.nicheId,
      userId,
    };
    const id = `snap_${userId}_${s.nicheId ?? "all"}_${day}`;
    await prisma.snapshot.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
}

/**
 * Trần dung lượng hiện hành, để giao diện tự chia file thành các lô vừa đủ thay
 * vì chặn người dùng bằng thông báo lỗi.
 */
export async function GET() {
  return NextResponse.json({
    maxFileBytes: MAX_FILE_BYTES,
    maxTotalBytes: MAX_TOTAL_BYTES,
    maxFiles: MAX_FILES,
    limitMb: LIMIT_MB,
  });
}

export async function POST(req: Request) {
  const auth = await requireUser("Cần đăng nhập để nhập dữ liệu.");
  if (!auth.ok) return auth.response;
  const { userId } = auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Dữ liệu tải lên không hợp lệ." }, { status: 400 });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) {
    return NextResponse.json({ error: "Chưa chọn file .xlsx nào." }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json({ error: `Tối đa ${MAX_FILES} file mỗi lần nhập.` }, { status: 400 });
  }

  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_TOTAL_BYTES) {
    const mb = (total / 1024 / 1024).toFixed(1);
    return NextResponse.json(
      { error: `Tổng dung lượng ${mb}MB vượt mức ${LIMIT_MB}MB mỗi lần gọi — chia thành nhiều lô nhỏ.` },
      { status: 413 },
    );
  }

  const nicheId = String(form.get("nicheId") ?? "").trim();
  const groupId = String(form.get("groupId") ?? "").trim();
  const subId = String(form.get("subId") ?? "").trim();
  const dryRun = String(form.get("dryRun") ?? "") === "1";

  let fixed: { groupId: string; subId: string } | null = null;
  if (groupId && subId) {
    const sub = await prisma.subGroup.findFirst({ where: { id: subId, userId } });
    if (!sub || sub.groupId !== groupId) {
      return NextResponse.json({ error: "Nhóm/sub-group đích không hợp lệ." }, { status: 400 });
    }
    fixed = { groupId, subId };
  }

  // ---- 1. Đọc toàn bộ file trước khi ghi bất cứ thứ gì ----

  const results: FileResult[] = [];
  const metricBatches: Batch<MetricsRow>[] = [];
  const postBatches: (Batch<PostRow> & { trends: TrendRow[] })[] = [];

  for (const file of files) {
    const name = decodeURIComponent(file.name);
    const result: FileResult = {
      file: name,
      kind: null,
      sheet: null,
      from: null,
      to: null,
      rows: 0,
      error: null,
    };

    try {
      if (file.size > MAX_FILE_BYTES) throw new Error(`File lớn hơn ${LIMIT_MB}MB.`);
      if (!/\.xlsx$/i.test(file.name)) throw new Error("Chỉ nhận file .xlsx.");

      const report = parseReport(Buffer.from(await file.arrayBuffer()));
      const reportedAt = report.period.to;

      result.kind = report.kind;
      result.sheet = report.sheet;
      result.rows = report.rows.length;
      result.from = report.period.from?.toISOString() ?? null;
      result.to = reportedAt?.toISOString() ?? null;

      if (report.kind === "metrics") {
        metricBatches.push({ file: name, reportedAt, rows: report.rows });
      } else {
        postBatches.push({ file: name, reportedAt, rows: report.rows, trends: report.trends });
      }
    } catch (e) {
      result.error = e instanceof Error ? e.message : "Không đọc được file.";
    }

    results.push(result);
  }

  // ---- 2. Lọc trùng trên toàn lô ----

  const pageDedupe = dedupePages(metricBatches);
  const postDedupe = dedupePosts(postBatches);
  const clashes: NameClash[] = nameClashes(pageDedupe.merged.map((m) => m.row));

  // ---- 3. Ghi xuống DB (bỏ qua khi chỉ soát trùng) ----

  const defaultNiche = nicheResolver(userId, nicheId || null);
  const known = await loadKnownPages(userId);
  const place = dryRun
    ? async () => ({ groupId: "", subId: "" })
    : await placer(userId, fixed, batchLabel(new Date()));

  const pageOut = await writePages(userId, pageDedupe.merged, known, place, defaultNiche, dryRun);

  // Một lần quét duy nhất cho phần còn lại của lô (bài viết, hashtag, nối lại).
  const needPages = postDedupe.merged.length > 0 || postBatches.some((b) => b.trends.length);
  const pageIndex = needPages ? await scanPages(userId) : [];

  const postOut = postDedupe.merged.length
    ? await writePosts(userId, pageIndex, postDedupe.merged, pageOut, defaultNiche, pageOut.touched, dryRun)
    : { created: 0, updated: 0, linked: 0 };

  let relinked = 0;
  if (!dryRun) {
    if (pageOut.created > 0) relinked = await relinkOrphanPosts(userId, pageIndex, pageOut.touched);
    if (postDedupe.merged.length) await reorderPosts(userId);
    await refreshNiches(pageOut.touched);
  }

  const trendCount = await writeTrends(userId, await trendsByNiche(pageIndex, postBatches), dryRun);

  if (!dryRun) {
    // Mốc của điểm mới trên biểu đồ = kỳ báo cáo mới nhất trong lô.
    const latest = [...metricBatches, ...postBatches]
      .map((b) => b.reportedAt)
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime())[0];
    await writeSnapshot(userId, latest ?? new Date());
  }

  const duplicates: DuplicateHit[] = [...pageDedupe.duplicates, ...postDedupe.duplicates];

  return NextResponse.json({
    dryRun,
    files: results,
    pages: {
      scanned: pageDedupe.scanned,
      unique: pageDedupe.merged.length,
      duplicates: pageDedupe.scanned - pageDedupe.merged.length,
      created: pageOut.created,
      updated: pageOut.updated,
      matchedByName: pageOut.matchedByName,
    },
    posts: {
      scanned: postDedupe.scanned,
      unique: postDedupe.merged.length,
      duplicates: postDedupe.scanned - postDedupe.merged.length,
      created: postOut.created,
      updated: postOut.updated,
      linked: postOut.linked,
      /** Bài đã nhập từ trước, nay mới nối được về page vừa tạo. */
      relinked,
    },
    trends: trendCount,
    duplicateSample: duplicates.slice(0, DUPLICATE_SAMPLE),
    duplicateTotal: duplicates.length,
    nameClashes: clashes,
    failed: results.filter((r) => r.error).length,
  });
}

/**
 * Gom hashtag của từng báo cáo top content về ngách chiếm đa số trong list page
 * của báo cáo đó — hashtag không tự mang thông tin ngách.
 */
async function trendsByNiche(
  pages: PageIndex[],
  batches: (Batch<PostRow> & { trends: TrendRow[] })[],
): Promise<Map<string, TrendRow[]>> {
  const out = new Map<string, TrendRow[]>();
  if (!batches.some((b) => b.trends.length)) return out;

  const byId = new Map(pages.map((p) => [p.ref, p.nicheId]));
  const bySlug = new Map(pages.map((p) => [p.slug, p.nicheId]));

  for (const batch of batches) {
    if (!batch.trends.length) continue;

    const votes = new Map<string, number>();
    for (const row of batch.rows) {
      const niche = byId.get(row.pageId) ?? bySlug.get(row.pageSlug);
      if (niche) votes.set(niche, (votes.get(niche) ?? 0) + 1);
    }

    const winner = [...votes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!winner) continue;

    out.set(winner, [...(out.get(winner) ?? []), ...batch.trends]);
  }

  return out;
}
