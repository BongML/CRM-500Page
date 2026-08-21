import { NextResponse } from "next/server";
import { buildTemplate, TEMPLATES } from "@/lib/templates";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Tải file mẫu: GET /api/templates?kind=classify|benchmark|content
 *
 * Mẫu được sinh ngay lúc gọi từ `src/lib/templates.ts` nên không bao giờ lệch
 * với bộ đọc — sửa cột ở một nơi là mẫu đổi theo. Không cần đăng nhập: đây là
 * tài liệu định dạng, không chứa dữ liệu của ai.
 */
export async function GET(req: Request) {
  const kind = new URL(req.url).searchParams.get("kind") ?? "";
  const made = buildTemplate(kind);

  if (!made) {
    return NextResponse.json(
      { error: `Không có mẫu "${kind}". Chọn: ${TEMPLATES.map((t) => t.kind).join(", ")}.` },
      { status: 404 },
    );
  }

  return new NextResponse(new Uint8Array(made.buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${made.file}"`,
      "Content-Length": String(made.buf.length),
      "Cache-Control": "no-store",
    },
  });
}
