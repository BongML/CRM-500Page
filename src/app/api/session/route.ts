import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Trạng thái đăng nhập — client gọi lúc mount để quyết định màn hình đầu. */
export async function GET() {
  const user = await currentUser();
  return NextResponse.json({ authed: !!user, user });
}
