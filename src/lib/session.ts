import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { readSession, signSession, SESSION_TTL_SECONDS } from "./auth";
import { ADMIN_ROLE } from "./admin";

export const SESSION_COOKIE = "crm_session";
/** Phạm vi dữ liệu admin đang xem: "all" (toàn hệ thống) hoặc một userId. */
export const SCOPE_COOKIE = "crm_scope";
export const ALL_SCOPE = "all";

/**
 * Cổng vào của mọi route có dữ liệu. Toàn bộ bảng nghiệp vụ đều mang `userId`,
 * nên **mọi truy vấn phải kèm bộ lọc lấy từ đây** — quên một chỗ là dữ liệu của
 * người này lọt sang người khác.
 *
 * Có hai cách lấy quyền, dùng đúng chỗ thì admin mới vừa nhìn được cả hệ thống
 * vừa không ghi nhầm dữ liệu sang tài khoản khác:
 *
 *   requireScope()  → BỘ LỌC đọc/sửa bản ghi đã có. Với admin ở chế độ "toàn hệ
 *                     thống", bộ lọc là {} nên chạm được mọi bản ghi.
 *   requireUser()   → MỘT userId cụ thể để **tạo mới** (nhóm, ngách, import).
 *                     Admin đang xem toàn hệ thống thì không có chủ sở hữu rõ
 *                     ràng: route trả 409 kèm lời nhắc chọn tài khoản đích.
 */

export type Account = { id: string; email: string; name: string; role: string };

/** userId của phiên hiện tại, hoặc null nếu chưa đăng nhập / token hết hạn. */
export async function currentUserId(): Promise<string | null> {
  const jar = await cookies();
  return readSession(jar.get(SESSION_COOKIE)?.value);
}

/** Phiên hiện tại kèm thông tin tài khoản (null nếu user đã bị xóa). */
export async function currentAccount(): Promise<Account | null> {
  const id = await currentUserId();
  if (!id) return null;
  return prisma.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true },
  });
}

/** Giữ tên cũ cho các nơi chỉ cần thông tin hiển thị. */
export const currentUser = currentAccount;

export const isAdmin = (account: Account | null) => account?.role === ADMIN_ROLE;

/** 401 chuẩn cho route cần đăng nhập. */
export const unauthorized = (message = "Cần đăng nhập.") =>
  NextResponse.json({ error: message }, { status: 401 });

/** 403 chuẩn cho route chỉ dành cho tài khoản tổng. */
export const forbidden = (message = "Chỉ tài khoản tổng mới dùng được chức năng này.") =>
  NextResponse.json({ error: message }, { status: 403 });

/**
 * Phạm vi dữ liệu của phiên hiện tại.
 * `userId = null` nghĩa là **toàn hệ thống** — chỉ admin mới có.
 */
export type DataScope = {
  /** Người đang đăng nhập. */
  actorId: string;
  admin: boolean;
  /** Chủ sở hữu dữ liệu đang thao tác; null = mọi tài khoản. */
  userId: string | null;
};

/** Bộ lọc Prisma tương ứng với phạm vi. Toàn hệ thống → {} (không lọc). */
export const scopeWhere = (scope: DataScope): { userId?: string } =>
  scope.userId ? { userId: scope.userId } : {};

async function readScopeCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SCOPE_COOKIE)?.value ?? null;
}

export async function currentScope(): Promise<DataScope | null> {
  const account = await currentAccount();
  if (!account) return null;

  // Người dùng thường: luôn khóa cứng vào chính mình, cookie phạm vi bị bỏ qua.
  if (account.role !== ADMIN_ROLE) {
    return { actorId: account.id, admin: false, userId: account.id };
  }

  const picked = await readScopeCookie();
  if (!picked || picked === ALL_SCOPE) {
    return { actorId: account.id, admin: true, userId: null };
  }

  // Tài khoản được chọn có thể đã bị xóa — quay về toàn hệ thống thay vì
  // truy vấn theo một userId không còn tồn tại.
  const target = await prisma.user.findUnique({ where: { id: picked }, select: { id: true } });
  return { actorId: account.id, admin: true, userId: target?.id ?? null };
}

export type ScopeAuth = { ok: true; scope: DataScope } | { ok: false; response: NextResponse };

export async function requireScope(message?: string): Promise<ScopeAuth> {
  const scope = await currentScope();
  return scope ? { ok: true, scope } : { ok: false, response: unauthorized(message) };
}

/**
 * Dùng ở đầu mỗi route **tạo mới dữ liệu**: trả userId chủ sở hữu, hoặc
 * `response` để route trả về ngay.
 *
 *   const auth = await requireUser();
 *   if (!auth.ok) return auth.response;
 *   // từ đây auth.userId là string
 */
export type Auth = { ok: true; userId: string; scope: DataScope } | { ok: false; response: NextResponse };

export async function requireUser(message?: string): Promise<Auth> {
  const scope = await currentScope();
  if (!scope) return { ok: false, response: unauthorized(message) };

  if (!scope.userId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Đang xem toàn hệ thống. Chọn một tài khoản cụ thể ở ô “Dữ liệu” trên thanh trên rồi thao tác lại.",
          needScope: true,
        },
        { status: 409 },
      ),
    };
  }

  return { ok: true, userId: scope.userId, scope };
}

/** Route chỉ dành cho tài khoản tổng. */
export type AdminAuth = { ok: true; account: Account } | { ok: false; response: NextResponse };

export async function requireAdmin(): Promise<AdminAuth> {
  const account = await currentAccount();
  if (!account) return { ok: false, response: unauthorized() };
  if (account.role !== ADMIN_ROLE) return { ok: false, response: forbidden() };
  return { ok: true, account };
}

export async function setSessionCookie(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** Đặt phạm vi dữ liệu cho admin. `null` = toàn hệ thống. */
export async function setScopeCookie(userId: string | null) {
  const jar = await cookies();
  jar.set(SCOPE_COOKIE, userId ?? ALL_SCOPE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearScopeCookie() {
  const jar = await cookies();
  jar.delete(SCOPE_COOKIE);
}
