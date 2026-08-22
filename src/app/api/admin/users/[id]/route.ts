import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { ADMIN_ROLE, USER_ROLE } from "@/lib/admin";
import { apiError } from "@/lib/api";
import { clearScopeCookie, currentScope, requireAdmin } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MIN_PASSWORD = 8;

/**
 * Sửa tài khoản: đổi tên, đặt lại mật khẩu, nâng/hạ quyền.
 * Body: { name?, password?, role? }
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    password?: string;
    role?: string;
  };

  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!target) return NextResponse.json({ error: "Tài khoản không còn tồn tại." }, { status: 404 });

  const data: { name?: string; password?: string; role?: string } = {};

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (!name) return NextResponse.json({ error: "Tên không được để trống." }, { status: 400 });
    data.name = name;
  }

  if (body.password !== undefined) {
    if (body.password.length < MIN_PASSWORD) {
      return NextResponse.json(
        { error: `Mật khẩu phải từ ${MIN_PASSWORD} ký tự trở lên.` },
        { status: 400 },
      );
    }
    data.password = hashPassword(body.password);
  }

  if (body.role !== undefined) {
    const role = body.role === ADMIN_ROLE ? ADMIN_ROLE : USER_ROLE;
    // Tự hạ quyền mình sẽ khóa luôn đường vào phần quản trị.
    if (role !== ADMIN_ROLE && target.id === auth.account.id) {
      return NextResponse.json({ error: "Không thể tự bỏ quyền của chính mình." }, { status: 409 });
    }
    if (role !== ADMIN_ROLE && target.role === ADMIN_ROLE) {
      const admins = await prisma.user.count({ where: { role: ADMIN_ROLE } });
      if (admins <= 1) {
        return NextResponse.json(
          { error: "Phải còn ít nhất 1 tài khoản tổng." },
          { status: 409 },
        );
      }
    }
    data.role = role;
  }

  if (!Object.keys(data).length) {
    return NextResponse.json({ error: "Không có thay đổi nào." }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, role: true },
    });
    return NextResponse.json(user);
  } catch (e) {
    return apiError(e, "Không cập nhật được tài khoản.");
  }
}

/** Xóa tài khoản — toàn bộ ngách/nhóm/page/bài của họ bị xóa theo (cascade). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  if (id === auth.account.id) {
    return NextResponse.json({ error: "Không thể tự xóa tài khoản đang dùng." }, { status: 409 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, _count: { select: { pages: true } } },
  });
  if (!target) return NextResponse.json({ error: "Tài khoản không còn tồn tại." }, { status: 404 });

  if (target.role === ADMIN_ROLE) {
    const admins = await prisma.user.count({ where: { role: ADMIN_ROLE } });
    if (admins <= 1) {
      return NextResponse.json({ error: "Phải còn ít nhất 1 tài khoản tổng." }, { status: 409 });
    }
  }

  try {
    await prisma.user.delete({ where: { id } });

    // Admin đang "xem theo" chính tài khoản vừa xóa thì đưa về toàn hệ thống.
    const scope = await currentScope();
    if (scope?.userId === id) await clearScopeCookie();

    return NextResponse.json({ ok: true, pages: target._count.pages });
  } catch (e) {
    return apiError(e, "Không xóa được tài khoản.");
  }
}
