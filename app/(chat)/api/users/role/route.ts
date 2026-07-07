import { auth } from "@/app/(auth)/auth";
import { db } from "@/lib/db/queries";
import { user } from "@/lib/db/schema";
import { ChatbotError } from "@/lib/errors";
import { isAdmin } from "@/lib/utils";
import { eq } from "drizzle-orm";

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new ChatbotError("unauthorized:users");
    }
    if (!isAdmin(session.user)) {
      throw new ChatbotError("forbidden:users");
    }

    const { userId, role } = await request.json();

    if (!userId || !role) {
      throw new ChatbotError("bad_request:users", "缺少用户ID或角色");
    }

    if (!["user", "moderator", "admin"].includes(role)) {
      throw new ChatbotError("bad_request:users", "无效的角色类型");
    }

    // 不能修改自己的角色
    if (userId === session.user.id) {
      throw new ChatbotError("bad_request:users", "不能修改自己的角色");
    }

    const updatedUser = await db
      .update(user)
      .set({ role })
      .where(eq(user.id, userId))
      .returning({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });

    if (updatedUser.length === 0) {
      throw new ChatbotError("not_found:users", "用户不存在");
    }

    return Response.json(updatedUser[0], { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) {
      return err.toResponse();
    }
    return new ChatbotError("bad_request:users").toResponse();
  }
}
