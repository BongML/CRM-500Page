import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, newId, validEmail } from "@/lib/auth";
import { ADMIN_ROLE, USER_ROLE, usingDefaultPassword } from "@/lib/admin";
import { apiError } from "@/lib/api";
import { requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIN_PASSWORD = 8;

/** Danh sách tài khoản kèm khối lượng dữ liệu của từng người — chỉ admin xem được. */
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const rows = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      password: true,
      _count: { select: { pages: true, niches: true, groups: true, topPosts: true } },
    },
  });

  const users = rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    pages: u._count.pages,
    niches: u._count.niches,
    groups: u._count.groups,
    posts: u._count.topPosts,
  }));

  // Cảnh báo nếu tài khoản tổng vẫn dùng mật khẩu mặc định (chỉ kiểm tra chính
  // người đang đăng nhập — scrypt tốn thời gian, không quét cả bảng).
  const me = rows.find((u) => u.id === auth.account.id);
  const defaultPassword = !!me && me.role === ADMIN_ROLE && usingDefaultPassword(me.password);

  return NextResponse.json({
    users,
    me: auth.account.id,
    defaultPassword,
    totals: {
      users: users.length,
      pages: users.reduce((a, u) => a + u.pages, 0),
      posts: users.reduce((a, u) => a + u.posts, 0),
    },
  });
}

/** Tạo tài khoản mới thay cho người dùng. Body: { email, password, name?, role? } */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
    name?: string;
    role?: string;
  };

  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const name = (body.name ?? "").trim() || email.split("@")[0];
  const role = body.role === ADMIN_ROLE ? ADMIN_ROLE : USER_ROLE;

  if (!validEmail(email)) {
    return NextResponse.json({ error: "Email không hợp lệ." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Mật khẩu phải từ ${MIN_PASSWORD} ký tự trở lên.` },
      { status: 400 },
    );
  }

  const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (taken) return NextResponse.json({ error: "Email này đã có tài khoản." }, { status: 409 });

  try {
    const user = await prisma.user.create({
      data: { id: newId(), email, name, password: hashPassword(password), role },
      select: { id: true, email: true, name: true, role: true, createdAt: true },
    });
    return NextResponse.json({
      ...user,
      createdAt: user.createdAt.toISOString(),
      pages: 0,
      niches: 0,
      groups: 0,
      posts: 0,
    });
  } catch (e) {
    return apiError(e, "Không tạo được tài khoản.");
  }
}
