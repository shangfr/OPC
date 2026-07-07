import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { updateUserByAdmin } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

/**
 * 平台管理员更新用户类型与套餐。
 * 仅 admin 角色可调用。可更新 role、accountType、planName。
 */
export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatbotError("unauthorized:api").toResponse();
    }
    if (session.user.role !== "admin") {
      return new ChatbotError("forbidden:api", "需要管理员权限").toResponse();
    }

    const { userId, role, accountType, planName } = (await req.json()) as {
      userId: string;
      role?: "admin" | "user";
      accountType?: "personal" | "enterprise";
      planName?: "free" | "base" | "plus";
    };

    if (!userId) {
      return new ChatbotError("bad_request:api", "缺少 userId").toResponse();
    }

    // 防止管理员降级自己（避免误操作锁死）
    if (userId === session.user.id && role && role !== "admin") {
      return new ChatbotError(
        "bad_request:api",
        "不能降级自己的管理员角色"
      ).toResponse();
    }

    await updateUserByAdmin({ userId, role, accountType, planName });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ChatbotError) return error.toResponse();
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
