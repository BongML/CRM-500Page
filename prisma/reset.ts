import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Dọn sạch dữ liệu nghiệp vụ. Hệ thống không có dữ liệu mẫu: toàn bộ Page,
 * top content và hashtag đều đến từ báo cáo Fanpage Karma nhập qua màn
 * "Quản lý dữ liệu → Nhập báo cáo". Chạy: npm run db:reset
 */
async function main() {
  // Xóa đúng thứ tự khóa ngoại.
  const snapshots = await prisma.snapshot.deleteMany();
  const trends = await prisma.trend.deleteMany();
  const posts = await prisma.topPost.deleteMany();
  const pages = await prisma.page.deleteMany();
  const subs = await prisma.subGroup.deleteMany();
  const groups = await prisma.group.deleteMany();
  const niches = await prisma.niche.deleteMany();

  console.log(
    `Da xoa: ${niches.count} nganh, ${groups.count} nhom, ${subs.count} sub-group, ` +
      `${pages.count} page, ${posts.count} top post, ${trends.count} hashtag, ` +
      `${snapshots.count} snapshot.`,
  );
  console.log("DB rong. Nhap bao cao .xlsx de co du lieu.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
