import { z } from "zod";
import {
  getPasswordResetToken,
  getUser,
  markResetTokenAsUsed,
  updateUserPassword,
} from "@/lib/db/queries";

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6, "密码至少需要 6 个字符"),
});

export async function POST(request: Request) {
  let body: z.infer<typeof resetPasswordSchema>;
  try {
    body = resetPasswordSchema.parse(await request.json());
  } catch {
    return Response.json({ message: "请求数据格式不正确" }, { status: 400 });
  }

  // 查找有效 token
  const resetToken = await getPasswordResetToken({ token: body.token });

  if (!resetToken) {
    return Response.json({ message: "重置链接无效或已过期" }, { status: 400 });
  }

  // 验证用户仍然存在
  const users = await getUser(resetToken.email);
  if (users.length === 0) {
    return Response.json({ message: "该账号已不存在" }, { status: 400 });
  }

  // 更新密码
  await updateUserPassword({
    email: resetToken.email,
    password: body.password,
  });

  // 标记 token 已使用
  await markResetTokenAsUsed({ id: resetToken.id });

  return Response.json(
    { message: "密码已重置成功，请使用新密码登录" },
    { status: 200 }
  );
}
