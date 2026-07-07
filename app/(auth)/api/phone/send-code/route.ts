import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  countRecentPhoneCodes,
  createPhoneVerificationCode,
  getUserByPhone,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import {
  generateVerificationCode,
  isValidChinaPhone,
  normalizePhone,
  sendVerificationSms,
  SMS_RATE_LIMIT,
} from "@/lib/ai/sms-service";

const schema = z.object({
  phone: z.string().min(1, "手机号不能为空"),
  purpose: z.enum(["register", "login"]).default("register"),
});

/**
 * POST /api/phone/send-code
 *
 * 发送手机号验证码
 * - 限流：同一手机号每小时最多 5 次，两次发送间隔至少 60 秒
 * - 注册用途：如果手机号已注册，返回错误（防止重复注册）
 * - 登录用途：如果手机号未注册，返回错误（提示先注册）
 */
export async function POST(request: Request) {
  try {
    let body: z.infer<typeof schema>;
    try {
      body = schema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:api",
        "请求数据格式不正确"
      ).toResponse();
    }

    const phone = normalizePhone(body.phone);

    if (!isValidChinaPhone(phone)) {
      return new ChatbotError(
        "bad_request:api",
        "手机号格式不正确，请输入 11 位中国大陆手机号"
      ).toResponse();
    }

    // 限流：每小时最多 5 次
    const recentCount = await countRecentPhoneCodes(phone, 60);
    if (recentCount >= SMS_RATE_LIMIT.maxPerHour) {
      return new ChatbotError(
        "rate_limit:api",
        `发送过于频繁，每小时最多 ${SMS_RATE_LIMIT.maxPerHour} 次，请稍后再试`
      ).toResponse();
    }

    // 注册用途：检查手机号是否已注册
    if (body.purpose === "register") {
      const existing = await getUserByPhone(phone);
      if (existing.length > 0) {
        return new ChatbotError(
          "bad_request:api",
          "该手机号已注册，请直接登录"
        ).toResponse();
      }
    }

    // 登录用途：检查手机号是否已注册
    if (body.purpose === "login") {
      const existing = await getUserByPhone(phone);
      if (existing.length === 0) {
        return new ChatbotError(
          "bad_request:api",
          "该手机号未注册，请先注册"
        ).toResponse();
      }
    }

    // 生成验证码并发送
    const code = generateVerificationCode();
    const sendResult = await sendVerificationSms(phone, code);

    if (!sendResult.success) {
      return new ChatbotError(
        "bad_request:api",
        `验证码发送失败: ${sendResult.error ?? "未知错误"}`
      ).toResponse();
    }

    // 保存验证码到数据库
    await createPhoneVerificationCode(phone, code, body.purpose);

    return Response.json(
      {
        success: true,
        messageId: sendResult.messageId,
        // 开发模式下返回验证码（仅用于调试，生产环境不返回）
        debugCode: process.env.NODE_ENV === "development" ? code : undefined,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    console.error("[phone/send-code] error:", err);
    return new ChatbotError("bad_request:api").toResponse();
  }
}
