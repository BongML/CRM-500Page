import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { refreshNiches } from "@/lib/aggregate";
import { requireUser } from "@/lib/session";
import { newId } from "@/lib/auth";
import { pageFallbackId, pageSlug } from "@/lib/karmar";
import { nicheResolver } from "@/lib/niche";
import { chunk, runBatch } from "@/lib/batch";
import { parsePageList, type ListEntry } from "@/lib/pagelist";
import {
  dropUpload,
  fromFile,
  takeUpload,
  LIMIT_MB,
  MAX_FILE_BYTES,
  type Incoming,
} from "@/lib/upload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Xếp page vào nhóm theo **file danh sách**. Hai cách chia, chọn bằng `mode`:
 *
 *  - "column" — file có cột **Nhóm**: mỗi nhãn trong cột đó là một nhóm, page
 *    nào ghi nhãn nào thì về nhóm ấy. Nhãn trùng tên với nhóm đang có thì dùng
 *    lại chính nhóm đó; nhóm và page không nằm trong file không bị đụng tới.
 *  - "size"   — file chỉ có thứ tự: cứ `size` page liên tiếp thành một nhóm.
 *
 * File không mang số liệu — số liệu vẫn đến từ báo cáo Karmar qua /api/import.
 * Bật `create` thì dòng chưa khớp page nào được tạo thành page mới với số liệu
 * 0, giữ đúng chỗ trong nhóm cho tới khi báo cáo Karmar về.
 *
 * Body: multipart/form-data
 *   file      — 1 file .xlsx / .csv / .txt chứa cột tên page (hoặc Profile-ID),
 *               gửi thẳng; hoặc `upload` — mã file đã tải lên theo mảnh qua
 *               /api/upload (đường client dùng mặc định, xem lib/upload.ts)
 *   mode      — "auto" (mặc định) | "column" | "size"
 *   size      — số page mỗi nhóm ở mode "size" (mặc định 25)
 *   create    — "1" để tạo page mới cho dòng chưa có trong hệ thống
 *   nicheId   — ngách cho page mới tạo ("" → "Chưa phân loại")
 *   rename    — "1" để đặt lại tên nhóm thành "Nhóm 01", "Nhóm 02"… (mode "size")
 *   leftover  — "append" xếp cả page không có trong file vào cuối danh sách,
 *               "keep" giữ chúng nguyên nhóm cũ (mặc định) — mode "size"
 *   prune     — "1" để xóa nhóm rỗng sau khi gom
 *   dryRun    — "1" để chỉ xem trước, không ghi gì xuống DB
 */

const MIN_SIZE = 1;
const MAX_SIZE = 500;
/** Số dòng không khớp / số nhóm gửi kèm về client để hiển thị. */
const SAMPLE = 60;
/** Số tên page xem trước trong mỗi nhóm. */
const GROUP_SAMPLE = 3;

const two = (n: number) => String(n).padStart(2, "0");

type Mode = "column" | "size";

type DbPage = {
  id: string;
  /** Profile-ID của báo cáo — khóa khớp với cột Profile-ID của file. */
  ref: string;
  slug: string;
  name: string;
  url: string | null;
  groupId: string;
  subId: string;
};

type DbGroup = {
  id: string;
  name: string;
  order: number;
  subs: { id: string; name: string; order: number }[];
  pages: { id: string }[];
};

/** Một page đã tìm được chỗ ngồi: page đang có, hoặc page sẽ tạo từ dòng file. */
type Placed = { entry: ListEntry; page: DbPage; fresh: boolean };

/** Nhóm sẽ hình thành sau khi ghi. `target` = nhóm đang có được dùng lại. */
type PlanGroup = {
  name: string;
  target: DbGroup | null;
  items: Placed[];
  /** Thứ tự mới; null = giữ nguyên thứ tự cũ của nhóm. */
  order: number | null;
};

/**
 * Rút gọn link fanpage về phần định danh để so khớp: bỏ giao thức, "www.",
 * tham số và dấu gạch chéo cuối. facebook.com/abc/?ref=x → facebook.com/abc
 */
function urlKey(url: string | null): string | null {
  if (!url) return null;
  const clean = url
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[?#]/)[0]
    .replace(/\/+$/, "");
  return clean || null;
}

/** Khóa so tên nhóm: "n8n_1_25" và "N8N_1_25 " là một. */
const groupKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, " ");

/** Nhãn hiển thị cho một dòng không khớp được page nào. */
const entryLabel = (e: ListEntry) => e.name || e.ref || e.url || "(dòng trống)";

/**
 * Khớp từng dòng của file về đúng một page đang có: Profile-ID trước, rồi tên
 * đã chuẩn hóa, cuối cùng là link. Mỗi page chỉ nhận một dòng — dòng sau trỏ về
 * page đã lấy thì tính là trùng, không xếp hai lần.
 *
 * `create` bật thì dòng không khớp ai trở thành page mới (chưa ghi xuống DB, chỉ
 * dựng sẵn ở đây) thay vì bị bỏ qua: file phân loại thường có cả page mà báo cáo
 * Karmar chưa từng nhắc tới — cột Profile-ID của chúng ghi 0.
 */
function resolveEntries(entries: ListEntry[], pages: DbPage[], create: boolean) {
  const byId = new Map(pages.map((p) => [p.ref, p]));
  const byUrl = new Map<string, DbPage>();
  const bySlug = new Map<string, DbPage>();
  const ambiguous = new Set<string>();

  for (const p of pages) {
    const key = urlKey(p.url);
    if (key && !byUrl.has(key)) byUrl.set(key, p);
    if (!p.slug) continue;
    if (bySlug.has(p.slug)) ambiguous.add(p.slug);
    bySlug.set(p.slug, p);
  }
  // Nhiều page cùng tên thì tên không còn phân biệt được ai — bỏ khỏi bảng tra.
  for (const slug of ambiguous) bySlug.delete(slug);

  const placed: Placed[] = [];
  const taken = new Set<string>();
  const unmatched: { line: number; label: string }[] = [];
  /** Dòng trỏ về page đã xếp ở dòng trên — liệt kê ra để sửa lại file. */
  const duplicates: { line: number; label: string }[] = [];

  for (const e of entries) {
    const key = urlKey(e.url);
    const hit =
      (e.ref ? byId.get(e.ref) : undefined) ??
      (e.name ? bySlug.get(pageSlug(e.name)) : undefined) ??
      (key ? byUrl.get(key) : undefined);

    if (hit) {
      if (taken.has(hit.ref)) {
        duplicates.push({ line: e.line, label: `${entryLabel(e)} → ${hit.name}` });
        continue;
      }
      taken.add(hit.ref);
      placed.push({ entry: e, page: hit, fresh: false });
      continue;
    }

    if (!create || !e.name) {
      unmatched.push({ line: e.line, label: entryLabel(e) });
      continue;
    }

    // Thiếu Profile-ID thì sinh id theo tên đúng công thức của báo cáo Karmar, để
    // lần nhập báo cáo sau ghép vào chính page này thay vì đẻ ra page thứ hai.
    const slug = pageSlug(e.name);
    const ref = e.ref ?? pageFallbackId(e.name);
    if (taken.has(ref)) {
      duplicates.push({ line: e.line, label: entryLabel(e) });
      continue;
    }

    const page: DbPage = { id: newId(), ref, slug, name: e.name, url: e.url, groupId: "", subId: "" };
    taken.add(ref);
    placed.push({ entry: e, page, fresh: true });
    // Dòng sau trùng tên / trùng ID với page vừa dựng cũng phải nhận ra là trùng.
    byId.set(ref, page);
    if (slug && !ambiguous.has(slug)) bySlug.set(slug, page);
  }

  return { placed, taken, unmatched, duplicates, ambiguous: [...ambiguous] };
}

/**
 * Mode "column": gom theo nhãn ở cột Nhóm, giữ thứ tự nhãn xuất hiện lần đầu
 * trong file. Nhóm đang có trùng tên được dùng lại và giữ nguyên `order` — phân
 * loại chỉ đổi chỗ ngồi của page trong file, không xáo lại cả hệ thống.
 */
function planByColumn(placed: Placed[], groups: DbGroup[]) {
  const existing = new Map(groups.map((g) => [groupKey(g.name), g]));
  const buckets = new Map<string, PlanGroup>();
  /** Dòng không ghi nhãn nhóm: để page yên chỗ cũ, không đoán thay người dùng. */
  const unlabelled: Placed[] = [];
  let nextOrder = groups.reduce((max, g) => Math.max(max, g.order + 1), 0);

  for (const item of placed) {
    const label = item.entry.group?.trim();
    if (!label) {
      unlabelled.push(item);
      continue;
    }

    const key = groupKey(label);
    let bucket = buckets.get(key);
    if (!bucket) {
      const target = existing.get(key) ?? null;
      bucket = {
        name: target?.name ?? label,
        target,
        items: [],
        order: target ? null : nextOrder++,
      };
      buckets.set(key, bucket);
    }
    bucket.items.push(item);
  }

  return { plan: [...buckets.values()], unlabelled };
}

/**
 * Mode "size": cứ `size` page liên tiếp theo thứ tự file thành một nhóm.
 * "append" nối page ngoài file vào đuôi để nhóm nào cũng đủ số; "keep" để chúng
 * đứng yên — khi đó nhóm còn giữ page ngoài file không được tái dùng, nếu không
 * nhóm sẽ vượt quá `size`.
 */
function planBySize(
  placed: Placed[],
  leftovers: DbPage[],
  groups: DbGroup[],
  opts: { size: number; append: boolean; rename: boolean },
) {
  const tail: Placed[] = opts.append
    ? leftovers.map((page) => ({
        entry: { line: 0, ref: page.ref, name: page.name, url: page.url, group: null },
        page,
        fresh: false,
      }))
    : [];
  const sequence = [...placed, ...tail];

  const stays = new Set(opts.append ? [] : leftovers.map((p) => p.id));
  const reusable = groups.filter((g) => !g.pages.some((p) => stays.has(p.id)));

  const plan: PlanGroup[] = [];
  for (let i = 0; i < sequence.length; i += opts.size) {
    const target = reusable[plan.length] ?? null;
    plan.push({
      name: opts.rename || !target ? `Nhóm ${two(plan.length + 1)}` : target.name,
      target,
      items: sequence.slice(i, i + opts.size),
      order: plan.length,
    });
  }

  return { plan, unlabelled: [] as Placed[] };
}

export async function POST(req: Request) {
  const auth = await requireUser("Cần đăng nhập để gom nhóm.");
  if (!auth.ok) return auth.response;
  const { userId } = auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Dữ liệu tải lên không hợp lệ." }, { status: 400 });
  }

  // File đến bằng hai đường: gửi thẳng (file nhỏ) hoặc đã tải lên theo mảnh.
  const raw = form.get("file");
  const uploadId = String(form.get("upload") ?? "").trim();
  let file: Incoming | null = raw instanceof File ? fromFile(raw) : null;

  if (!file && uploadId) {
    file = await takeUpload(userId, uploadId);
    if (!file) {
      return NextResponse.json(
        { error: "File tải lên chưa đủ mảnh — thử chọn lại file và chạy lại." },
        { status: 400 },
      );
    }
  }
  if (!file) {
    return NextResponse.json({ error: "Chưa chọn file danh sách page." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    if (uploadId) await dropUpload(userId, uploadId);
    return NextResponse.json({ error: `File lớn hơn ${LIMIT_MB}MB.` }, { status: 413 });
  }

  const rawSize = Math.round(Number(form.get("size") ?? 25));
  if (!Number.isFinite(rawSize) || rawSize < MIN_SIZE || rawSize > MAX_SIZE) {
    return NextResponse.json(
      { error: `Số page mỗi nhóm phải từ ${MIN_SIZE} đến ${MAX_SIZE}.` },
      { status: 400 },
    );
  }

  const size = rawSize;
  const wanted = String(form.get("mode") ?? "auto");
  const create = String(form.get("create") ?? "") === "1";
  const nicheId = String(form.get("nicheId") ?? "").trim();
  const rename = String(form.get("rename") ?? "1") === "1";
  const appendLeftover = String(form.get("leftover") ?? "keep") === "append";
  const prune = String(form.get("prune") ?? "") === "1";
  const dryRun = String(form.get("dryRun") ?? "") === "1";
  const fileName = file.name;

  // ---- 1. Đọc file & chọn cách chia ----

  let list;
  try {
    list = parsePageList(await file.read(), fileName);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không đọc được file." },
      { status: 400 },
    );
  }

  // "auto": có cột Nhóm thì phân loại theo cột, không thì chia đều.
  const mode: Mode =
    wanted === "column" || wanted === "size" ? wanted : list.labelled ? "column" : "size";

  if (mode === "column" && !list.labelled) {
    return NextResponse.json(
      { error: 'File không có cột "Nhóm" (hoặc cột đó bỏ trống) — chọn cách chia đều N page/nhóm.' },
      { status: 400 },
    );
  }

  // ---- 2. Khớp về page đang có (kèm dựng page mới nếu được bật) ----

  const pages: DbPage[] = await prisma.page.findMany({
    where: { userId },
    select: { id: true, ref: true, slug: true, name: true, url: true, groupId: true, subId: true },
    orderBy: { name: "asc" },
  });
  if (!pages.length && !create) {
    return NextResponse.json(
      { error: "Hệ thống chưa có page nào — nhập báo cáo Karmar trước, hoặc bật tạo page mới." },
      { status: 400 },
    );
  }

  const match = resolveEntries(list.entries, pages, create);
  if (!match.placed.length) {
    return NextResponse.json(
      { error: "Không dòng nào trong file khớp với page đang có trong hệ thống." },
      { status: 400 },
    );
  }

  const leftovers = pages.filter((p) => !match.taken.has(p.ref));

  const groups: DbGroup[] = await prisma.group.findMany({
    where: { userId },
    orderBy: { order: "asc" },
    include: { subs: { orderBy: { order: "asc" } }, pages: { select: { id: true } } },
  });

  const { plan, unlabelled } =
    mode === "column"
      ? planByColumn(match.placed, groups)
      : planBySize(match.placed, leftovers, groups, { size, append: appendLeftover, rename });

  if (!plan.length) {
    return NextResponse.json(
      { error: 'Không dòng nào khớp được ghi nhãn ở cột "Nhóm".' },
      { status: 400 },
    );
  }

  // ---- 3. Ghi xuống DB (bỏ qua khi chỉ xem trước) ----

  const defaultNiche = nicheResolver(userId, nicheId || null);
  const stamp = Date.now().toString(36);
  /** Sổ đầu người của từng nhóm sau khi xếp — để biết nhóm nào sẽ rỗng. */
  const headcount = new Map(groups.map((g) => [g.id, g.pages.length]));
  const report: { name: string; count: number; created: boolean; fresh: number; sample: string[] }[] =
    [];
  const usedGroupIds = new Set<string>();
  const touched = new Set<string>();
  const newPages: string[] = [];
  /** Page mới của cả lô — ghi một lần ở cuối thay vì mỗi page một lệnh. */
  const creates: Prisma.PageCreateManyInput[] = [];
  /** Lệnh chuyển chỗ page của từng nhóm — gửi gộp một lượt ở cuối. */
  const moves: Prisma.PrismaPromise<unknown>[] = [];
  let moved = 0;

  for (let i = 0; i < plan.length; i++) {
    const bucket = plan[i];
    const target = bucket.target;
    const fresh = bucket.items.filter((it) => it.fresh);
    const settled = bucket.items.filter((it) => !it.fresh);

    moved += settled.filter((it) => !target || it.page.groupId !== target.id).length;
    for (const it of fresh) newPages.push(it.page.name);

    report.push({
      name: bucket.name,
      count: bucket.items.length,
      created: !target,
      fresh: fresh.length,
      sample: bucket.items.slice(0, GROUP_SAMPLE).map((it) => it.page.name),
    });

    // Đánh dấu ngay cả khi chỉ xem trước, để phần "nhóm rỗng" bên dưới đếm đúng.
    if (target) usedGroupIds.add(target.id);

    let groupId: string;
    let subId: string;

    if (target) {
      groupId = target.id;
      subId = target.subs[0]?.id ?? `${groupId}-s${stamp}`;
      if (!dryRun) {
        if (bucket.order !== null && (bucket.name !== target.name || target.order !== bucket.order)) {
          await prisma.group.updateMany({
            where: { id: groupId, userId },
            data: { name: bucket.name, order: bucket.order },
          });
        }
        if (!target.subs.length) {
          await prisma.subGroup.create({
            data: { id: subId, name: "Sub-group A", groupId, order: 0, userId },
          });
        }
      }
    } else {
      groupId = newId();
      subId = `${groupId}-s1`;
      if (!dryRun) {
        await prisma.group.create({
          data: {
            id: groupId,
            name: bucket.name,
            order: bucket.order ?? i,
            userId,
            subs: { create: { id: subId, name: "Sub-group A", order: 0, userId } },
          },
        });
      }
    }

    // Page rời nhóm cũ, nhập nhóm mới — cập nhật sổ đầu người cả khi chỉ xem trước.
    for (const it of settled) {
      if (it.page.groupId === groupId) continue;
      headcount.set(it.page.groupId, (headcount.get(it.page.groupId) ?? 0) - 1);
      headcount.set(groupId, (headcount.get(groupId) ?? 0) + 1);
    }
    if (fresh.length) headcount.set(groupId, (headcount.get(groupId) ?? 0) + fresh.length);

    if (dryRun) continue;

    if (settled.length) {
      moves.push(
        prisma.page.updateMany({
          where: { id: { in: settled.map((it) => it.page.id) }, userId },
          data: { groupId, subId },
        }),
      );
    }

    for (const it of fresh) {
      const niche = await defaultNiche();
      touched.add(niche);
      creates.push({
        id: it.page.id,
        ref: it.page.ref,
        slug: it.page.slug,
        name: it.page.name,
        url: it.page.url,
        follower: 0,
        posts: 0,
        likes: 0,
        comments: 0,
        rate: 0,
        ppi: 0,
        views: 0,
        reach: 0,
        groupId,
        subId,
        nicheIds: [niche],
        userId,
      });
    }
  }

  // Chuyển chỗ trước, tạo page mới sau — cả hai đều là một lượt đi-về, không
  // phải mỗi nhóm một lượt như trước.
  await runBatch(moves);
  for (const part of chunk(creates)) {
    await prisma.page.createMany({ data: part, skipDuplicates: true });
  }

  // ---- 4. Nhóm không tham gia: đánh số tiếp & lọc nhóm rỗng ----
  // Chỉ ở mode "size": cả hệ thống là một dãy "Nhóm NN" liền mạch, không có hai
  // nhóm cùng tên. Mode "column" cố ý không đụng tới nhóm nằm ngoài file.

  const untouched = groups.filter((g) => !usedGroupIds.has(g.id));
  const emptied = untouched.filter((g) => !(headcount.get(g.id) ?? 0)).map((g) => g.name);

  let renumbered = 0;
  if (mode === "size") {
    for (const g of untouched) {
      if (!(headcount.get(g.id) ?? 0)) continue; // sẽ rỗng — để phần dọn lo
      const order = plan.length + renumbered;
      renumbered++;
      if (dryRun || !rename) continue;
      await prisma.group.updateMany({
        where: { id: g.id, userId },
        data: { name: `Nhóm ${two(order + 1)}`, order },
      });
    }
  }

  let pruned = 0;
  if (prune && !dryRun) {
    const survivors = await prisma.group.findMany({
      where: { userId },
      select: { id: true, _count: { select: { pages: true } } },
    });
    const dead = survivors.filter((g) => g._count.pages === 0).map((g) => g.id);
    if (dead.length) {
      await prisma.subGroup.deleteMany({ where: { groupId: { in: dead }, userId } });
      pruned = (await prisma.group.deleteMany({ where: { id: { in: dead }, userId } })).count;
    }
  }

  // Page mới làm số tổng hợp của ngách sai lệch nếu không tính lại.
  if (!dryRun && touched.size) await refreshNiches(touched);

  return NextResponse.json({
    dryRun,
    mode,
    file: fileName,
    sheet: list.sheet,
    size,
    rows: list.entries.length,
    labelled: list.labelled,
    brokenRefs: list.broken,
    matched: match.placed.length,
    duplicates: match.duplicates.length,
    moved,
    duplicateSample: match.duplicates.slice(0, SAMPLE),
    created: newPages.length,
    createdSample: newPages.slice(0, SAMPLE),
    unlabelled: unlabelled.length,
    leftover: leftovers.length,
    leftoverMode: mode === "size" && appendLeftover ? "append" : "keep",
    groups: report.slice(0, SAMPLE),
    renumbered: mode === "size" && rename ? renumbered : 0,
    groupTotal: report.length,
    newGroups: report.filter((g) => g.created).length,
    unmatched: match.unmatched.slice(0, SAMPLE),
    unmatchedTotal: match.unmatched.length,
    ambiguous: match.ambiguous.slice(0, SAMPLE),
    emptied: emptied.slice(0, SAMPLE),
    pruned,
  });
}
