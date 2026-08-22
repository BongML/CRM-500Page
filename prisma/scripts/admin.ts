import { PrismaClient } from "@prisma/client";
import { hashPassword, newId } from "../../src/lib/auth";

/**
 * Tạo hoặc đặt lại tài khoản tổng từ dòng lệnh.
 *
 *   npm run admin                          → dùng email/mật khẩu mặc định
 *   npm run admin -- sep@congty.vn 123456789   → email + mật khẩu chỉ định
 *
 * Bình thường không cần chạy: app tự dựng tài khoản tổng ở lần đăng nhập đầu
 * tiên bằng email admin (xem src/lib/admin.ts). Script này để dùng khi quên mật
 * khẩu, hoặc muốn nâng một tài khoản có sẵn lên quyền tổng.
 */

const DEFAULT_EMAIL = (process.env.CRM_ADMIN_EMAIL ?? "").trim() || "admin@crm.vn";
const ENV_PASSWORD = process.env.CRM_ADMIN_PASSWORD ?? "";
const DEFAULT_PASSWORD = ENV_PASSWORD.length >= 8 ? ENV_PASSWORD : "Admin@123456";

async function main() {
  const email = (process.argv[2] ?? DEFAULT_EMAIL).trim().toLowerCase();
  const password = process.argv[3] ?? DEFAULT_PASSWORD;

  if (password.length < 8) throw new Error("Mat khau phai tu 8 ky tu tro len.");

  const prisma = new PrismaClient();
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { role: "admin", password: hashPassword(password) },
    });
    console.log(`Da nang quyen + dat lai mat khau cho ${email}.`);
  } else {
    await prisma.user.create({
      data: {
        id: newId(),
        email,
        name: "Quan tri he thong",
        password: hashPassword(password),
        role: "admin",
      },
    });
    console.log(`Da tao tai khoan tong ${email}.`);
  }

  const users = await prisma.user.count();
  const pages = await prisma.page.count();
  console.log(`He thong dang co ${users} tai khoan, ${pages} page.`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
