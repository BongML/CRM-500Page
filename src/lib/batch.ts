import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

/**
 * Gộp nhiều lệnh ghi thành ít vòng đi-về tới DB.
 *
 * Với SQLite trên ổ cứng thì `await` từng dòng gần như miễn phí. Với Postgres ở
 * xa (Neon) mỗi lệnh tốn một vòng mạng — 500 page nhập vào là 500 vòng, đủ để
 * chạm trần thời gian chạy hàm của Vercel. `$transaction([...])` gửi cả mảng
 * trong một lần, nên chi phí mạng gần như không đổi theo số dòng.
 *
 * Chia theo lô thay vì nhét tất cả vào một transaction: transaction quá lớn giữ
 * khóa lâu và dễ chạm giới hạn thời gian của chính DB.
 */

/** Số lệnh mỗi transaction — đủ lớn để tiết kiệm vòng mạng, đủ nhỏ để không giữ khóa lâu. */
export const BATCH_SIZE = 100;

export async function runBatch(
  ops: Prisma.PrismaPromise<unknown>[],
  size = BATCH_SIZE,
): Promise<void> {
  for (let i = 0; i < ops.length; i += size) {
    await prisma.$transaction(ops.slice(i, i + size));
  }
}

/** Chia mảng thành từng lô để gọi createMany nhiều lần cho gọn payload. */
export function chunk<T>(rows: T[], size = BATCH_SIZE * 5): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}
