import { writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

/**
 * Xuất toàn bộ dữ liệu đang có ra JSON bằng SQL thô — dùng trước khi đổi sang
 * schema đa người dùng. Đọc thô vì Prisma Client lúc này đã sinh theo schema
 * MỚI, không khớp các bảng cũ.
 *
 * Chạy: npx tsx prisma/scripts/dump.ts <đường-dẫn-file.json>
 */
const TABLES = ["User", "Niche", "Group", "SubGroup", "Page", "TopPost", "Trend", "Snapshot"];

async function main() {
  const out = process.argv[2];
  if (!out) throw new Error("Thiếu đường dẫn file JSON đích.");

  const prisma = new PrismaClient();
  const data: Record<string, unknown[]> = {};

  for (const table of TABLES) {
    const rows = (await prisma.$queryRawUnsafe(`SELECT * FROM "${table}"`)) as unknown[];
    data[table] = rows;
    console.log(`${table}: ${rows.length}`);
  }

  writeFileSync(out, JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v), 1));
  console.log("Da ghi:", out);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
