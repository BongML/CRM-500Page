import { NextResponse } from "next/server";

/**
 * Đổi lỗi Prisma thành response gọn cho client. Hay gặp nhất là P2025 —
 * bản ghi đã bị xóa ở tab/phiên khác.
 */
export function apiError(e: unknown, fallback = "Không thực hiện được thao tác.") {
  const code = (e as { code?: string })?.code;

  if (code === "P2025") {
    return NextResponse.json({ error: "Bản ghi không còn tồn tại — tải lại trang." }, { status: 404 });
  }
  if (code === "P2003") {
    return NextResponse.json(
      { error: "Còn dữ liệu liên quan đang tham chiếu, không xóa được." },
      { status: 409 },
    );
  }

  console.error(e);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
