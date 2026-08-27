import { prisma } from "@/lib/prisma";
import { newId } from "@/lib/auth";

/**
 * Nhận file lớn qua nhiều mảnh.
 *
 * Vì sao phải cắt: hàm serverless (Vercel) chặn **body mỗi request** quá ~4.5MB
 * trước khi code kịp chạy, nên gửi thẳng một file 6–50MB là hỏng bất kể trần
 * của ứng dụng đặt bao nhiêu. Client cắt file thành mảnh nhỏ hơn con số đó
 * (CHUNK_BYTES), gửi lần lượt vào bảng UploadPart, rồi báo mã `uploadId` cho
 * /api/import hoặc /api/groups/arrange; ở đó các mảnh được ghép lại thành file
 * gốc và xóa ngay.
 *
 * Trần dung lượng vì thế là trần của **ứng dụng** chứ không còn của nền tảng:
 * mặc định 50MB, chỉnh bằng CRM_MAX_UPLOAD_MB.
 */

const MB = 1024 * 1024;

const CONFIGURED_MB = Number(process.env.CRM_MAX_UPLOAD_MB);
export const LIMIT_MB =
  Number.isFinite(CONFIGURED_MB) && CONFIGURED_MB > 0 ? CONFIGURED_MB : 50;

/** Trần mỗi file. */
export const MAX_FILE_BYTES = LIMIT_MB * MB;
/**
 * Trần tổng dung lượng xử lý trong **một lần nhập** — client tự chia lô theo con
 * số này. Giữ bằng trần mỗi file để hàm serverless không phải giữ quá chừng đó
 * byte trong RAM cùng lúc.
 */
export const MAX_TOTAL_BYTES = MAX_FILE_BYTES;

/**
 * Cỡ mỗi mảnh. Phải nhỏ hơn hẳn trần body của nền tảng (~4.5MB) vì còn phần bao
 * multipart và các trường đi kèm.
 */
export const CHUNK_BYTES = 3 * MB;

/** Số mảnh tối đa của một file, suy ra từ trần dung lượng (+1 cho phần lẻ). */
export const MAX_PARTS = Math.ceil(MAX_FILE_BYTES / CHUNK_BYTES) + 1;

/** Mảnh mồ côi (tải dở rồi bỏ giữa chừng) sống tối đa 1 giờ. */
const PART_TTL_MS = 60 * 60 * 1000;

/** Mã upload do client sinh — chỉ nhận dạng uuid/chuỗi an toàn. */
const ID_OK = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Một file đầu vào đã biết tên và dung lượng, nội dung nạp sau (`read`). Route
 * nhập dùng chung kiểu này cho cả file gửi thẳng lẫn file ghép từ nhiều mảnh.
 */
export type Incoming = {
  name: string;
  size: number;
  read: () => Promise<Buffer>;
};

/** Tên file gốc; giải mã %20… nhưng chịu được tên có dấu % lạc. */
export function safeName(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** File gửi thẳng trong multipart (đường cũ, dùng khi file đủ nhỏ). */
export function fromFile(file: File): Incoming {
  return {
    name: safeName(file.name),
    size: file.size,
    read: async () => Buffer.from(await file.arrayBuffer()),
  };
}

/** Ghi một mảnh. Gửi lại cùng (uploadId, index) chỉ ghi đè, không nhân bản. */
export async function savePart(part: {
  userId: string;
  uploadId: string;
  name: string;
  index: number;
  total: number;
  data: Uint8Array<ArrayBuffer>;
}): Promise<void> {
  const { userId, uploadId, index } = part;
  await prisma.uploadPart.upsert({
    where: { userId_uploadId_index: { userId, uploadId, index } },
    create: {
      id: newId(),
      uploadId,
      name: part.name,
      index,
      total: part.total,
      size: part.data.byteLength,
      data: part.data,
      userId,
    },
    update: { name: part.name, total: part.total, size: part.data.byteLength, data: part.data },
  });
}

/** Dọn mảnh mồ côi. Gọi kèm mỗi lần tải lên nên không cần cron riêng. */
export async function sweepParts(): Promise<void> {
  await prisma.uploadPart.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - PART_TTL_MS) } },
  });
}

/**
 * Đọc file đã tải xong theo `uploadId`: trả tên + dung lượng ngay, nội dung để
 * `read()` nạp sau (và xóa mảnh khỏi DB). Thiếu mảnh hoặc mã lạ → null.
 */
export async function takeUpload(userId: string, uploadId: string): Promise<Incoming | null> {
  if (!ID_OK.test(uploadId)) return null;

  const parts = await prisma.uploadPart.findMany({
    where: { userId, uploadId },
    select: { name: true, index: true, total: true, size: true },
    orderBy: { index: "asc" },
  });
  if (!parts.length || parts.length !== parts[0].total) return null;

  return {
    name: safeName(parts[0].name),
    size: parts.reduce((sum, p) => sum + p.size, 0),
    read: async () => {
      const rows = await prisma.uploadPart.findMany({
        where: { userId, uploadId },
        select: { data: true },
        orderBy: { index: "asc" },
      });
      await prisma.uploadPart.deleteMany({ where: { userId, uploadId } });
      return Buffer.concat(rows.map((r) => Buffer.from(r.data)));
    },
  };
}

/** Bỏ file đã tải lên mà không đọc (khi lô bị chặn trước lúc nhập). */
export async function dropUpload(userId: string, uploadId: string): Promise<void> {
  if (!ID_OK.test(uploadId)) return;
  await prisma.uploadPart.deleteMany({ where: { userId, uploadId } });
}

/** Các con số client cần biết để cắt mảnh và chia lô. */
export const uploadLimits = () => ({
  limitMb: LIMIT_MB,
  maxFileBytes: MAX_FILE_BYTES,
  maxTotalBytes: MAX_TOTAL_BYTES,
  chunkBytes: CHUNK_BYTES,
});
