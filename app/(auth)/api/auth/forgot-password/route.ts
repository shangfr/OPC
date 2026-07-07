import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createPasswordResetToken, getUser } from "@/lib/db/queries";

const forgotPasswordSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
});

export async function POST(request: Request) {
  let body: z.infer<typeof forgotPasswordSchema>;
  try {
    body = forgotPasswordSchema.parse(await request.json());
  } catch {
    return Response.json({ message: "邮箱格式不正确" }, { status: 400 });
  }

  const users = await getUser(body.email);

  // 无论邮箱是否存在，都返回成功（防止邮箱枚举）
  // 只有已注册的邮箱才会真正生成 token
  if (users.length === 0) {
    return Response.json(
      { message: "如果该邮箱已注册，您将收到重置密码的链接" },
      { status: 200 }
    );
  }

  // 生成重置 token（有效期 1 小时）
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await createPasswordResetToken({
    email: body.email,
    token,
    expiresAt,
  });

  // TODO: 集成邮件服务发送重置链接
  // 当前开发阶段，将重置链接返回给前端展示
  const baseUrl = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const resetLink = `${baseUrl}/reset-password/${token}`;

  console.log(`[Password Reset] 重置链接: ${resetLink}`);

  return Response.json(
    {
      message: "如果该邮箱已注册，您将收到重置密码的链接",
      // 开发环境下返回重置链接，方便测试
      ...(process.env.NODE_ENV !== "production" ? { resetLink } : {}),
    },
    { status: 200 }
  );
}
