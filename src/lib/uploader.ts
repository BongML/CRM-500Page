"use client";

/**
 * Đẩy file lên theo nhiều mảnh (đối tác phía trình duyệt của lib/upload.ts).
 *
 * Gửi thẳng cả file là hỏng ngay khi file quá ~4.5MB: hàm serverless chặn body
 * request ở đó trước khi code kịp chạy. Nên file được cắt thành mảnh nhỏ hơn
 * ngưỡng ấy, gửi lần lượt vào /api/upload, và nơi gọi chỉ cầm về `uploadId` để
 * đưa cho route nhập.
 */

/** Con số do /api/upload công bố; chưa hỏi được thì tạm dùng mức an toàn nhất. */
export type UploadLimits = {
  limitMb: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  chunkBytes: number;
};

const MB = 1024 * 1024;

export const DEFAULT_LIMITS: UploadLimits = {
  limitMb: 20,
  maxFileBytes: 20 * MB,
  maxTotalBytes: 20 * MB,
  chunkBytes: 3 * MB,
};

/** Hỏi trần dung lượng của server; hỏi không được thì giữ mức mặc định. */
export async function fetchLimits(): Promise<UploadLimits> {
  try {
    const res = await fetch("/api/upload");
    const l = (await res.json()) as Partial<UploadLimits>;
    if (l.limitMb && l.maxFileBytes && l.maxTotalBytes && l.chunkBytes) {
      return l as UploadLimits;
    }
  } catch {
    /* giữ mặc định */
  }
  return DEFAULT_LIMITS;
}

function newUploadId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Tải một file lên, trả về `uploadId` để route nhập ghép lại.
 * `onProgress(sent, total)` chạy sau mỗi mảnh, để hiện tiến độ.
 */
export async function uploadInParts(
  file: File,
  chunkBytes: number,
  onProgress?: (sent: number, total: number) => void,
): Promise<string> {
  const id = newUploadId();
  const size = Math.max(1, chunkBytes);
  const total = Math.max(1, Math.ceil(file.size / size));

  for (let i = 0; i < total; i++) {
    const body = new FormData();
    body.append("uploadId", id);
    body.append("name", file.name);
    body.append("index", String(i));
    body.append("total", String(total));
    body.append("chunk", file.slice(i * size, (i + 1) * size), file.name);

    const res = await fetch("/api/upload", { method: "POST", body });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.error ?? `Tải "${file.name}" lên thất bại.`);
    }
    onProgress?.(i + 1, total);
  }

  return id;
}
