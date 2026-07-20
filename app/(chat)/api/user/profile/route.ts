import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth, unstable_update } from "@/app/(auth)/auth";
import { updateUserProfile } from "@/lib/db/queries";

export async function PUT(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (name !== undefined) {
      if (typeof name !== "string") {
        return NextResponse.json(
          { error: "用户名格式不正确" },
          { status: 400 }
        );
      }
      const trimmed = name.trim();
      if (trimmed.length === 0) {
        return NextResponse.json(
          { error: "用户名不能为空" },
          { status: 400 }
        );
      }
      if (trimmed.length > 32) {
        return NextResponse.json(
          { error: "用户名不能超过 32 个字符" },
          { status: 400 }
        );
      }
    }

    await updateUserProfile({
      userId: session.user.id,
      name: name?.trim(),
    });

    // 通过 unstable_update 将新用户名直接写入 JWT token 并持久化到
    // session cookie，确保刷新页面后 session.user.name 立即生效。
    //
    // 类型说明：unstable_update 的参数类型是 Partial<Session>，
    // 但 jwt callback 中通过 trigger === "update" 读取 session.name 字段。
    // 这里用类型断言传递 name 字段（见 auth.ts jwt callback 的 updateData 处理）。
    await unstable_update({ name: name?.trim() } as Partial<Session>);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[profile update] error:", error);
    return NextResponse.json(
      { error: "更新失败，请重试" },
      { status: 500 }
    );
  }
}
