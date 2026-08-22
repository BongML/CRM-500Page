import { prisma } from "./prisma";
import { hashPassword, newId, verifyPassword } from "./auth";

/**
 * Tài khoản tổng (admin).
 *
 * Admin không phải là một không gian dữ liệu riêng: nó **nhìn xuyên** mọi tài
 * khoản. A có 200 page, B 500, C 300 thì admin thấy đủ 1000 page trong một
 * dashboard (xem `currentScope` trong lib/session.ts).
 *
 * Email/mật khẩu mặc định chỉ để đăng nhập lần đầu. Trên môi trường thật hãy
 * đặt CRM_ADMIN_EMAIL / CRM_ADMIN_PASSWORD, hoặc đổi mật khẩu ngay trong
 * màn "Quản lý dữ liệu > Người dùng".
 */

export const ADMIN_ROLE = "admin";
export const USER_ROLE = "user";

export const DEFAULT_ADMIN_EMAIL = "admin@crm.vn";
export const DEFAULT_ADMIN_PASSWORD = "Admin@123456";

export const adminEmail = () =>
  ((process.env.CRM_ADMIN_EMAIL ?? "").trim() || DEFAULT_ADMIN_EMAIL).toLowerCase();

/** Biến môi trường để trống hoặc quá ngắn thì coi như chưa đặt. */
export const adminPassword = () => {
  const set = process.env.CRM_ADMIN_PASSWORD ?? "";
  return set.length >= 8 ? set : DEFAULT_ADMIN_PASSWORD;
};

/**
 * Bảo đảm luôn tồn tại tài khoản tổng — gọi ở đầu route đăng nhập khi email
 * trùng email admin, nên không cần chạy script tay sau khi deploy.
 *
 *  - Chưa có user nào mang email đó → tạo mới với mật khẩu mặc định.
 *  - Đã có (do đăng ký thường) → chỉ nâng quyền, **không** đụng vào mật khẩu:
 *    người dùng đã đổi mật khẩu thì phải giữ nguyên.
 */
export async function ensureAdmin(): Promise<void> {
  const email = adminEmail();
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        id: newId(),
        email,
        name: "Quản trị hệ thống",
        password: hashPassword(adminPassword()),
        role: ADMIN_ROLE,
      },
    });
    console.warn(`[admin] Đã tạo tài khoản tổng ${email} với mật khẩu mặc định — hãy đổi ngay.`);
    return;
  }

  if (existing.role !== ADMIN_ROLE) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: ADMIN_ROLE } });
  }
}

/**
 * Admin còn đang dùng mật khẩu mặc định **có sẵn trong mã nguồn**? Dùng để cảnh
 * báo trên giao diện. Mật khẩu đặt qua CRM_ADMIN_PASSWORD là mật khẩu riêng của
 * người vận hành nên không tính là mặc định.
 */
export function usingDefaultPassword(stored: string): boolean {
  return verifyPassword(DEFAULT_ADMIN_PASSWORD, stored);
}
