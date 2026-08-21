import { inflateRawSync } from "node:zlib";

/**
 * Bộ đọc .xlsx tối giản (không phụ thuộc thư viện ngoài): giải nén ZIP rồi đọc
 * thẳng XML của SpreadsheetML. Đủ dùng cho file export của Fanpage Karma —
 * shared strings, inline string, số, ô lỗi (#DIV/0!), ô % và ô ngày.
 *
 * Quy ước giá trị trả về:
 *  - ô định dạng % trả theo **đơn vị phần trăm** (0.048 → 4.8) cho khớp schema;
 *  - ô định dạng ngày trả chuỗi ISO;
 *  - ô lỗi trả null.
 */

export type CellValue = string | number | null;
/** Một dòng: khóa là chữ cái cột ("B", "C", …). */
export type Row = Record<string, CellValue>;
export type Sheet = { name: string; rows: Row[] };

// ---- ZIP ----

function readZip(buf: Buffer): Map<string, Buffer> {
  const EOCD = 0x06054b50;
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 22 - 0xffff; i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("File không phải .xlsx hợp lệ (thiếu ZIP end record).");

  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const files = new Map<string, Buffer>();

  for (let i = 0; i < count; i++) {
    if (off + 46 > buf.length || buf.readUInt32LE(off) !== 0x02014b50) break;
    const method = buf.readUInt16LE(off + 10);
    const compSize = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const localOff = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);

    // Kích thước ở local header có thể để trống nên lấy theo central directory.
    const dataStart =
      localOff + 30 + buf.readUInt16LE(localOff + 26) + buf.readUInt16LE(localOff + 28);
    const raw = buf.subarray(dataStart, dataStart + compSize);
    files.set(name, method === 0 ? raw : inflateRawSync(raw));

    off += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// ---- XML ----

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function unescapeXml(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1] === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code] ?? m;
  });
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp("(?:^|\\s)" + name.replace(":", "\\:") + '="([^"]*)"').exec(tag);
  return m ? m[1] : null;
}

/** Ghép mọi <t> bên trong một khối (chuỗi rich-text bị cắt thành nhiều <t>). */
function textOf(xml: string): string {
  let out = "";
  for (const m of xml.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) out += m[1];
  return unescapeXml(out);
}

function sharedStrings(files: Map<string, Buffer>): string[] {
  const xml = files.get("xl/sharedStrings.xml")?.toString("utf8");
  if (!xml) return [];
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));
}

type CellFormat = "plain" | "percent" | "date";

const BUILTIN_DATE_IDS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/** Với mỗi style index (thuộc tính s= của ô) → kiểu định dạng cần diễn giải. */
function cellFormats(files: Map<string, Buffer>): CellFormat[] {
  const xml = files.get("xl/styles.xml")?.toString("utf8");
  if (!xml) return [];

  const custom = new Map<number, string>();
  for (const m of xml.matchAll(/<numFmt\b[^>]*\/>/g)) {
    const id = Number(attr(m[0], "numFmtId"));
    const code = attr(m[0], "formatCode");
    if (Number.isFinite(id) && code) custom.set(id, unescapeXml(code));
  }

  const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml);
  if (!cellXfs) return [];

  return [...cellXfs[1].matchAll(/<xf\b[^>]*>/g)].map((m) => {
    const id = Number(attr(m[0], "numFmtId") ?? 0);
    const code = custom.get(id);
    if (id === 9 || id === 10 || (code && code.includes("%"))) return "percent";
    if (BUILTIN_DATE_IDS.has(id) || (code && /[yd]/i.test(code.replace(/\[[^\]]*\]/g, ""))))
      return "date";
    return "plain";
  });
}

/** Số serial của Excel (gốc 1899-12-30) → chuỗi ISO. */
export function excelSerialToISO(serial: number): string {
  return new Date(Math.round((serial - 25569) * 86_400_000)).toISOString();
}

function parseSheet(xml: string, strings: string[], formats: CellFormat[]): Row[] {
  const rows: Row[] = [];

  for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row: Row = {};

    for (const cellMatch of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cellMatch[1];
      const inner = cellMatch[2] ?? "";
      const ref = attr(`<c ${attrs}>`, "r");
      if (!ref) continue;
      const col = ref.replace(/\d+/g, "");

      const type = attr(`<c ${attrs}>`, "t") ?? "n";
      const styleIdx = Number(attr(`<c ${attrs}>`, "s") ?? -1);
      const rawValue = /<v>([\s\S]*?)<\/v>/.exec(inner)?.[1];

      let value: CellValue = null;
      if (type === "s") {
        value = strings[Number(rawValue)] ?? null;
      } else if (type === "inlineStr") {
        value = textOf(inner);
      } else if (type === "str") {
        value = rawValue === undefined ? null : unescapeXml(rawValue);
      } else if (type === "e") {
        value = null; // #DIV/0!, #N/A… → coi như không có số liệu
      } else if (type === "b") {
        value = rawValue === "1" ? 1 : 0;
      } else if (rawValue !== undefined && rawValue !== "") {
        const n = Number(rawValue);
        if (Number.isFinite(n)) {
          const fmt = formats[styleIdx] ?? "plain";
          if (fmt === "percent") value = n * 100;
          else if (fmt === "date") value = excelSerialToISO(n);
          else value = n;
        } else {
          value = unescapeXml(rawValue);
        }
      }

      if (value !== null && value !== "") row[col] = value;
    }

    rows.push(row);
  }

  return rows;
}

/** Đọc toàn bộ workbook. Sheet giữ nguyên thứ tự trong file. */
export function readXlsx(buf: Buffer): Sheet[] {
  const files = readZip(buf);
  const workbook = files.get("xl/workbook.xml")?.toString("utf8");
  if (!workbook) throw new Error("File .xlsx thiếu xl/workbook.xml.");

  const rels = new Map<string, string>();
  const relsXml = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  for (const m of relsXml.matchAll(/<Relationship\b[^>]*\/>/g)) {
    const id = attr(m[0], "Id");
    const target = attr(m[0], "Target");
    if (id && target) rels.set(id, target.replace(/^\/?xl\//, "").replace(/^\.\//, ""));
  }

  const strings = sharedStrings(files);
  const formats = cellFormats(files);
  const sheets: Sheet[] = [];

  for (const m of workbook.matchAll(/<sheet\b[^>]*\/>/g)) {
    const name = unescapeXml(attr(m[0], "name") ?? "");
    const rid = attr(m[0], "r:id") ?? attr(m[0], "id");
    const target = rid ? rels.get(rid) : null;
    const xml = target ? files.get("xl/" + target)?.toString("utf8") : undefined;
    if (!xml) continue;
    sheets.push({ name, rows: parseSheet(xml, strings, formats) });
  }

  return sheets;
}
