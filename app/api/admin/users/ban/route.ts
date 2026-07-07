import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { banUser, unbanUser } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

/**
 * 管理员封禁/解封用户账号（风控）。
 * POST   /api/admin/users/ban  body: { userId, reason }  → 封禁
 * DELETE /api/admin/users/ban  body: { userId }          → 解封
 */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: new ChatbotError("unauthorized:api").toResponse() };
  }
  if (session.user.role !== "admin") {
    return {
      error: new ChatbotError("forbidden:api", "需要管理员权限").toResponse(),
    };
  };
  return { session };
}

export async function POST(req: Request) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const { userId, reason } = (await req.json()) as {
      userId: string;
      reason: string;
    };
    if (!userId || !reason) {
      return new ChatbotError("bad_request:api", "缺少 userId 或 reason").toResponse();
    }
    await banUser({ userId, reason });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ChatbotError) return error.toResponse();
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const adminCheck = await requireAdmin();
  if ("error" in adminCheck) return adminCheck.error;

  try {
    const { userId } = (await req.json()) as { userId: string };
    if (!userId) {
      return new ChatbotError("bad_request:api", "缺少 userId").toResponse();
    }
    await unbanUser({ userId });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ChatbotError) return error.toResponse();
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
