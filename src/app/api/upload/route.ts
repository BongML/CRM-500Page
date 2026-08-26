import { NextResponse } from "next/server";
import { requireUser } from "@/lib/session";
import { CHUNK_BYTES, MAX_PARTS, savePart, sweepParts, uploadLimits } from "@/lib/upload";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Nhận **một mảnh** của file đang tải lên (xem lib/upload.ts). Client gọi lần
 * lượt cho tới hết file rồi đưa `uploadId` cho /api/import hoặc
 * /api/groups/arrange — chính chỗ đó ghép mảnh lại và xóa.
 *
 * Body: multipart/form-data
 *   uploadId — mã cả file, client sinh (uuid)
 *   name     — tên file gốc
 *   index    — thứ tự mảnh, 0-based
 *   total    — tổng số mảnh
 *   chunk    — nội dung mảnh (≤ CHUNK_BYTES)
 *
 * GET trả về các con số client cần để cắt mảnh và chia lô.
 */

export async function GET() {
  return NextResponse.json(uploadLimits());
}

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const auth = await requireUser("Cần đăng nhập để tải file lên.");
  if (!auth.ok) return auth.response;
  const { userId } = auth;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return bad("Dữ liệu tải lên không hợp lệ.");
  }

  const uploadId = String(form.get("uploadId") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const index = Number(form.get("index"));
  const total = Number(form.get("total"));
  const chunk = form.get("chunk");

  if (!/^[A-Za-z0-9_-]{8,64}$/.test(uploadId)) return bad("Mã tải lên không hợp lệ.");
  if (!name) return bad("Thiếu tên file.");
  if (!Number.isInteger(total) || total < 1 || total > MAX_PARTS) {
    return bad(`File quá lớn — tối đa ${MAX_PARTS} mảnh mỗi file.`, 413);
  }
  if (!Number.isInteger(index) || index < 0 || index >= total) return bad("Thứ tự mảnh không hợp lệ.");
  if (!(chunk instanceof File)) return bad("Thiếu nội dung mảnh.");
  if (chunk.size > CHUNK_BYTES) return bad("Mảnh vượt cỡ cho phép.", 413);

  await savePart({
    userId,
    uploadId,
    name,
    index,
    total,
    data: new Uint8Array(await chunk.arrayBuffer()),
  });

  // Dọn mảnh của những lần tải dở dang trước đó — không có thì cũng rẻ.
  if (index === 0) await sweepParts();

  return NextResponse.json({ ok: true, index, total });
}
