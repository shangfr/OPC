import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
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

    const response = NextResponse.json({ success: true });
    response.cookies.set("refresh_session", "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60,
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("[profile update] error:", error);
    return NextResponse.json(
      { error: "更新失败，请重试" },
      { status: 500 }
    );
  }
}
