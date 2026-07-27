import { randomBytes } from "node:crypto";
import { z } from "zod";
import { createPasswordResetToken, getUser } from "@/lib/db/queries";

const forgotPasswordSchema = z.object({
  email: z.string().email("邮箱格式不正确"),
});

/**
 * POST /api/auth/forgot-password
 *
 * 忘记密码（Mock 模式）
 *
 * Mock 行为：
 * - 无论邮箱是否存在，都返回成功（防止邮箱枚举）
 * - 生成重置 token 并返回重置链接给前端
 * - 不发送真实邮件
 */
export async function POST(request: Request) {
  let body: z.infer<typeof forgotPasswordSchema>;
  try {
    body = forgotPasswordSchema.parse(await request.json());
  } catch {
    return Response.json({ message: "邮箱格式不正确" }, { status: 400 });
  }

  const users = await getUser(body.email);

  // 无论邮箱是否存在，都返回成功（防止邮箱枚举）
  if (users.length === 0) {
    return Response.json(
      {
        message: "如果该邮箱已注册，您将收到重置密码的链接",
        // Mock 模式：即使邮箱不存在也返回一个假的重置链接
        resetLink: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/reset-password/mock-reset-token`,
        mockMode: true,
      },
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

  // Mock 模式：将重置链接返回给前端展示（不发送邮件）
  const baseUrl = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const resetLink = `${baseUrl}/reset-password/${token}`;

  return Response.json(
    {
      message: "重置链接已生成（Mock 模式，未发送邮件）",
      resetLink,
      mockMode: true,
    },
    { status: 200 }
  );
}
