import { readXlsx, type CellValue, type Row, type Sheet } from "./xlsx";

/**
 * Nhận diện & bóc dữ liệu 2 loại báo cáo export từ Fanpage Karma. Cùng một list
 * page thường được export ra cả hai, ghép lại thành 2 cách thể hiện của hệ thống:
 *
 *  - "metrics": sheet "Metrics Overview"      → số liệu benchmark từng page;
 *  - "posts":   sheet "Top 25 Posts Overview" → top content + hashtag nổi bật.
 *
 * Cả hai đều có cột Profile-ID nên khớp được về đúng một Page. Cột được dò theo
 * tên tiêu đề nên thêm/bớt cột ở Karmar vẫn chạy.
 */

export type MetricsRow = {
  id: string;
  slug: string;
  name: string;
  network: string | null;
  url: string | null;
  follower: number;
  posts: number;
  likes: number;
  comments: number;
  rate: number;
  ppi: number;
  views: number;
  reach: number;
};

export type PostRow = {
  id: string;
  caption: string;
  pageName: string;
  pageSlug: string;
  pageId: string;
  time: string;
  link: string | null;
  image: string | null;
  likes: number;
  comments: number;
  rcs: number;
  rate: number;
  reach: number;
  ipi: number;
  neg: number;
};

export type TrendRow = { term: string; posts: number; rate: string };

/** Kỳ báo cáo đọc từ dòng tiêu đề ("Jul 23, 2026 - Aug 19, 2026"). */
export type Period = { from: Date | null; to: Date | null };

export type ParsedReport =
  | { kind: "metrics"; sheet: string; period: Period; rows: MetricsRow[] }
  | { kind: "posts"; sheet: string; period: Period; rows: PostRow[]; trends: TrendRow[] };

const norm = (v: CellValue) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

function num(v: CellValue): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  const n = parseFloat(String(v ?? "").replace(/[^\d.,-]/g, "").replace(/,/g, "."));
  return Number.isFinite(n) ? n : 0;
}

const str = (v: CellValue) => String(v ?? "").trim();

/** Chuỗi rỗng → null (dùng cho các cột link không bắt buộc). */
const opt = (v: CellValue) => str(v) || null;

/**
 * Khóa lọc trùng theo tên page: thường hóa, bỏ dấu tổ hợp, gom khoảng trắng.
 * Dùng khi báo cáo thiếu Profile-ID hoặc khi page cũ đã nhập bằng tên.
 */
export function pageSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Profile-ID thay thế cho page mà nguồn dữ liệu không kèm ID thật. Sinh từ tên
 * đã chuẩn hóa nên báo cáo Karmar và file phân loại đặt cùng một page vào cùng
 * một id — nhập báo cáo sau vẫn ghép đúng vào page đã tạo từ file.
 */
export function pageFallbackId(name: string): string {
  return hashId("fp", pageSlug(name));
}

/** Tiêu đề đã chuẩn hóa → chữ cái cột. */
type Header = Map<string, string>;

/** Dò dòng tiêu đề trong 15 dòng đầu: dòng chứa đủ các nhãn bắt buộc. */
function findHeader(sheet: Sheet, required: string[]): { header: Header; from: number } | null {
  const limit = Math.min(sheet.rows.length, 15);
  for (let i = 0; i < limit; i++) {
    const header: Header = new Map();
    for (const [col, value] of Object.entries(sheet.rows[i])) {
      const key = norm(value);
      if (key && !header.has(key)) header.set(key, col);
    }
    if (required.every((r) => header.has(r))) return { header, from: i + 1 };
  }
  return null;
}

/** Lấy giá trị theo tiêu đề (thử lần lượt các tên gọi có thể có). */
function cell(row: Row, header: Header, ...names: string[]): CellValue {
  for (const n of names) {
    const col = header.get(n);
    if (col && row[col] !== undefined) return row[col];
  }
  return null;
}

/** Chuỗi thời gian hiển thị trong bảng top content: "20/08/2026 13:47". */
export function formatTime(iso: CellValue): string {
  const raw = str(iso);
  if (!raw) return "";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** ID ổn định cho page/bài mà báo cáo không kèm Profile-ID / Message-ID. */
function hashId(prefix: string, seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return prefix + h.toString(36);
}

/**
 * Kỳ báo cáo nằm ở dòng ngay trên header: "Jul 23, 2026 - Aug 19, 2026".
 * Không đọc được thì trả null — khi đó lấy thời điểm nhập làm mốc.
 */
function findPeriod(sheet: Sheet, headerAt: number): Period {
  for (let i = Math.max(0, headerAt - 3); i <= headerAt; i++) {
    for (const value of Object.values(sheet.rows[i] ?? {})) {
      const m = /^(.+?)\s*[-–]\s*(.+)$/.exec(str(value));
      if (!m) continue;
      const from = new Date(m[1]);
      const to = new Date(m[2]);
      if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) return { from, to };
    }
  }
  return { from: null, to: null };
}

function parseMetrics(sheet: Sheet): { rows: MetricsRow[]; period: Period } | null {
  const found = findHeader(sheet, ["profile"]);
  if (!found) return null;
  const { header, from } = found;
  if (!header.has("page performance index") && !header.has("daily views")) return null;

  const rows: MetricsRow[] = [];

  for (let i = from; i < sheet.rows.length; i++) {
    const r = sheet.rows[i];
    const name = str(cell(r, header, "profile"));
    if (!name) continue;

    rows.push({
      id: str(cell(r, header, "profile-id", "profile id")) || pageFallbackId(name),
      slug: pageSlug(name),
      name,
      network: opt(cell(r, header, "network")),
      url: opt(cell(r, header, "external links", "link")),
      follower: Math.round(num(cell(r, header, "follower", "followers"))),
      posts: Math.round(num(cell(r, header, "number of posts"))),
      likes: Math.round(num(cell(r, header, "number of likes"))),
      comments: Math.round(num(cell(r, header, "number of comments"))),
      rate: +num(cell(r, header, "post interaction rate")).toFixed(2),
      ppi: Math.round(num(cell(r, header, "page performance index"))),
      views: Math.round(num(cell(r, header, "daily views", "number of views"))),
      reach: Math.round(num(cell(r, header, "reach per day", "reach"))),
    });
  }

  return rows.length ? { rows, period: findPeriod(sheet, from - 1) } : null;
}

function parsePosts(sheet: Sheet): { rows: PostRow[]; period: Period } | null {
  const found = findHeader(sheet, ["message", "profile"]);
  if (!found) return null;
  const { header, from } = found;

  const rows: PostRow[] = [];

  for (let i = from; i < sheet.rows.length; i++) {
    const r = sheet.rows[i];
    const caption = str(cell(r, header, "message"));
    const pageName = str(cell(r, header, "profile"));
    if (!caption && !pageName) continue;

    const link = opt(cell(r, header, "link"));

    rows.push({
      id: str(cell(r, header, "message-id", "message id")) || hashId("tp", link ?? caption),
      caption: caption.replace(/\s+/g, " ").trim(),
      pageName,
      pageSlug: pageSlug(pageName),
      pageId: str(cell(r, header, "profile-id", "profile id")),
      time: formatTime(cell(r, header, "date", "time")),
      link,
      image: opt(cell(r, header, "image link")),
      likes: Math.round(num(cell(r, header, "number of likes"))),
      comments: Math.round(num(cell(r, header, "number of comments"))),
      rcs: Math.round(num(cell(r, header, "reactions, comments & shares", "interactions"))),
      rate: +num(cell(r, header, "post interaction rate")).toFixed(2),
      reach: Math.round(num(cell(r, header, "reach per post", "reach"))),
      ipi: +num(cell(r, header, "interactions per impression/view")).toFixed(2),
      neg: +num(cell(r, header, "post comments negative sentiment share")).toFixed(2),
    });
  }

  return rows.length ? { rows, period: findPeriod(sheet, from - 1) } : null;
}

/**
 * Sheet "Top 50 Hashtags …": Karmar để hashtag ở cột "Profile", số bài ở cột
 * "value" và bội số so với trung bình ở "Times above average".
 */
function parseTrends(sheets: Sheet[]): TrendRow[] {
  const sheet = sheets.find((s) => norm(s.name).includes("hashtags"));
  if (!sheet) return [];

  const found = findHeader(sheet, ["profile", "value"]);
  if (!found) return [];
  const { header, from } = found;

  const out: TrendRow[] = [];
  for (let i = from; i < sheet.rows.length; i++) {
    const term = str(cell(sheet.rows[i], header, "profile"));
    if (!term.startsWith("#")) continue;

    const above = Math.round(num(cell(sheet.rows[i], header, "times above average")));
    out.push({
      term,
      posts: Math.round(num(cell(sheet.rows[i], header, "value"))),
      rate: above > 0 ? `${above}× TB` : "—",
    });
  }

  // Hashtag khỏe nhất lên đầu: nhiều bài trước, rồi tới bội số tương tác.
  return out.sort((a, b) => b.posts - a.posts).slice(0, 12);
}

/** Đọc 1 file .xlsx và tự nhận diện loại báo cáo. Ném lỗi nếu không khớp mẫu nào. */
export function parseReport(buf: Buffer): ParsedReport {
  const sheets = readXlsx(buf);

  const asMetrics = (sheet: Sheet): ParsedReport | null => {
    const got = parseMetrics(sheet);
    return got && { kind: "metrics", sheet: sheet.name, period: got.period, rows: got.rows };
  };

  const asPosts = (sheet: Sheet): ParsedReport | null => {
    const got = parsePosts(sheet);
    return (
      got && {
        kind: "posts",
        sheet: sheet.name,
        period: got.period,
        rows: got.rows,
        trends: parseTrends(sheets),
      }
    );
  };

  for (const sheet of sheets) {
    const name = norm(sheet.name);
    if (name.includes("metrics overview")) {
      const got = asMetrics(sheet);
      if (got) return got;
    }
    if (name.includes("posts overview")) {
      const got = asPosts(sheet);
      if (got) return got;
    }
  }

  // Không khớp tên sheet (Karmar đổi nhãn) → dò theo tiêu đề cột.
  for (const sheet of sheets) {
    const got = asMetrics(sheet);
    if (got) return got;
  }
  for (const sheet of sheets) {
    const got = asPosts(sheet);
    if (got) return got;
  }

  throw new Error(
    "Không nhận diện được báo cáo. Cần sheet 'Metrics Overview' (benchmark) hoặc 'Top 25 Posts Overview' (top content).",
  );
}
