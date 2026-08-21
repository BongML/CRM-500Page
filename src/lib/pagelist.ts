import { readXlsx, type CellValue, type Row } from "./xlsx";

/**
 * Đọc **file danh sách page** — loại file thứ hai hệ thống nhận, khác báo cáo
 * Karmar: nó không mang số liệu, chỉ mang **thứ tự**. Thứ tự dòng trong file
 * chính là thứ tự xếp nhóm (xem /api/groups/arrange).
 *
 * Cố ý dễ tính với định dạng vì file này thường do người dùng tự gõ:
 *  - .xlsx (lấy sheet nhiều dòng nhất) hoặc .csv/.txt;
 *  - dò cột theo tiêu đề (Profile / Page / Tên page / Profile-ID / Nhóm / Link);
 *  - không có tiêu đề thì lấy cột đầu tiên có nhiều chữ nhất làm cột tên.
 *
 * Có cột **Nhóm** thì file không chỉ mang thứ tự mà mang cả cách phân loại: mỗi
 * nhãn trong cột đó là một nhóm page (xem mode "column" của /api/groups/arrange).
 */

export type ListEntry = {
  /** Số dòng trong file (1-based) để báo lỗi cho đúng chỗ. */
  line: number;
  /** Profile-ID nếu file có cột đó. Ô để trống hoặc ghi "0" đều tính là thiếu. */
  ref: string | null;
  name: string;
  url: string | null;
  /** Nhãn ở cột "Nhóm" — tên nhóm mà dòng này thuộc về. */
  group: string | null;
};

export type PageList = {
  sheet: string | null;
  entries: ListEntry[];
  /** Số dòng có nhãn nhóm — 0 nghĩa là file chỉ mang thứ tự, không phân loại. */
  labelled: number;
  /** Số ô Profile-ID bị Excel làm tròn nên phải bỏ, khớp bằng tên thay thế. */
  broken: number;
};

const norm = (v: CellValue) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const str = (v: CellValue) => String(v ?? "").trim();

const NAME_KEYS = ["profile", "page", "page name", "tên page", "ten page", "fanpage", "name", "tên", "ten"];
const ID_KEYS = ["profile-id", "profile id", "profileid", "id"];
const URL_KEYS = ["external links", "external link", "link", "links", "url", "website"];
const GROUP_KEYS = ["nhóm", "nhom", "group", "cụm", "cum", "team", "batch", "phân loại", "phan loai"];

/**
 * Profile-ID chỉ tin được khi là số nguyên chính xác. Excel lưu số theo IEEE
 * double: ID dài quá bị ghi thành "1.21954E+20" — chỉ còn 6 chữ số có nghĩa, và
 * hai ID khác nhau có thể rơi về cùng một giá trị. Dùng ID kiểu đó sẽ gán nhầm
 * page, nên coi như dòng không có ID và khớp theo tên (bảo người dùng xuất lại
 * cột Profile-ID dưới dạng **text**).
 */
function usableRef(raw: string): boolean {
  if (!/^\d+$/.test(raw)) return true; // ID không thuần số: hiếm, cứ giữ nguyên
  return raw.length <= 16 && Number.isSafeInteger(Number(raw));
}

/** Ô Profile-ID coi như bỏ trống: rỗng, "0", "-", "n/a"… */
const BLANK_REF = /^(0+|[-–—]+|n\/?a|null|none|undefined)$/i;

/** Tiêu đề đã chuẩn hóa → khóa cột. */
type Header = Map<string, string>;

function pick(header: Header, keys: string[]): string | null {
  for (const k of keys) {
    const col = header.get(k);
    if (col) return col;
  }
  // Rơi về so khớp chứa: "tên page (fanpage)" vẫn nhận ra là cột tên.
  for (const [text, col] of header) {
    if (keys.some((k) => text.includes(k))) return col;
  }
  return null;
}

/** Dò dòng tiêu đề trong 15 dòng đầu: dòng có ít nhất một cột tên/ID nhận ra được. */
type Cols = { name: string | null; id: string | null; url: string | null; group: string | null };

function findHeader(rows: Row[]): { cols: Cols; from: number } | null {
  const limit = Math.min(rows.length, 15);

  for (let i = 0; i < limit; i++) {
    const header: Header = new Map();
    for (const [col, value] of Object.entries(rows[i])) {
      const key = norm(value);
      if (key && !header.has(key)) header.set(key, col);
    }
    if (!header.size) continue;

    const name = pick(header, NAME_KEYS);
    const id = pick(header, ID_KEYS);
    if (!name && !id) continue;

    const url = pick(header, URL_KEYS);
    // Một cột chỉ đóng một vai: "Nhóm page" đã là cột tên thì không kiêm cột nhóm.
    const group = pick(header, GROUP_KEYS);
    const taken = new Set([name, id, url].filter(Boolean));

    return { cols: { name, id, url, group: group && !taken.has(group) ? group : null }, from: i + 1 };
  }
  return null;
}

/** Không có tiêu đề: cột nào nhiều ô chữ (không phải số) nhất thì đó là cột tên. */
function widestTextColumn(rows: Row[]): string | null {
  const score = new Map<string, number>();
  for (const row of rows) {
    for (const [col, value] of Object.entries(row)) {
      const text = str(value);
      if (text.length < 2 || /^[\d.,%-]+$/.test(text)) continue;
      score.set(col, (score.get(col) ?? 0) + 1);
    }
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

function collect(rows: Row[], sheet: string | null): PageList {
  const found = findHeader(rows);
  const from = found?.from ?? 0;
  const nameCol = found?.cols.name ?? widestTextColumn(rows);
  const idCol = found?.cols.id ?? null;
  const urlCol = found?.cols.url ?? null;
  const groupCol = found?.cols.group ?? null;

  if (!nameCol && !idCol) return { sheet, entries: [], labelled: 0, broken: 0 };

  const entries: ListEntry[] = [];
  /** Số ô Profile-ID đã hỏng vì Excel làm tròn — chỉ để cảnh báo. */
  let broken = 0;

  for (let i = from; i < rows.length; i++) {
    const row = rows[i];
    const name = nameCol ? str(row[nameCol]) : "";
    const raw = idCol ? str(row[idCol]) : "";
    const blank = !raw || BLANK_REF.test(raw);
    if (!blank && !usableRef(raw)) broken++;
    const ref = blank || !usableRef(raw) ? "" : raw;
    const url = urlCol ? str(row[urlCol]) : "";
    const group = groupCol ? str(row[groupCol]).replace(/\s+/g, " ") : "";
    if (!name && !ref) continue;
    // Dòng số thứ tự thuần số ("1", "2"…) ở cột tên là rác, không phải page.
    if (!ref && /^[\d.,]+$/.test(name)) continue;

    entries.push({ line: i + 1, ref: ref || null, name, url: url || null, group: group || null });
  }

  return { sheet, entries, labelled: entries.filter((e) => e.group).length, broken };
}

/** Tách một dòng CSV, hiểu ô có dấu nháy kép và dấu phẩy bên trong nháy. */
function splitCsv(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

const COL = (i: number) => String.fromCharCode(65 + (i % 26)).repeat(Math.floor(i / 26) + 1);

function readCsv(text: string): Row[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const sep = (lines.find((l) => l.trim()) ?? "").includes(";") ? ";" : ",";

  return lines.map((line) => {
    const row: Row = {};
    splitCsv(line, sep).forEach((cell, i) => {
      const v = cell.trim();
      if (v) row[COL(i)] = v;
    });
    return row;
  });
}

/**
 * Bóc danh sách page theo đúng thứ tự trong file. Ném lỗi có chữ tiếng Việt khi
 * không đọc được — thông báo này hiển thị thẳng cho người dùng.
 */
export function parsePageList(buf: Buffer, filename: string): PageList {
  if (/\.(csv|txt|tsv)$/i.test(filename)) {
    const rows = readCsv(buf.toString("utf8"));
    const list = collect(rows, null);
    if (!list.entries.length) throw new Error("Không tìm thấy cột tên page nào trong file.");
    return list;
  }

  if (!/\.xlsx$/i.test(filename)) throw new Error("Chỉ nhận file .xlsx, .csv hoặc .txt.");

  const sheets = readXlsx(buf).filter((s) => s.rows.length);
  if (!sheets.length) throw new Error("File không có sheet nào đọc được.");

  // Ưu tiên sheet dò ra tiêu đề; không có thì lấy sheet nhiều dòng nhất.
  const ranked = [...sheets].sort((a, b) => b.rows.length - a.rows.length);
  const lists = ranked.map((s) => collect(s.rows, s.name)).filter((l) => l.entries.length);
  // Sheet mang cột Nhóm được ưu tiên: nó chở nhiều thông tin hơn sheet chỉ có tên.
  const best = lists.find((l) => l.labelled) ?? lists[0] ?? { sheet: null, entries: [], labelled: 0, broken: 0 };

  if (!best.entries.length) throw new Error("Không tìm thấy cột tên page nào trong file.");
  return best;
}
