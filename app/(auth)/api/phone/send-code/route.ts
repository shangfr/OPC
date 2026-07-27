import { z } from "zod";
import {
  createPhoneVerificationCode,
  getUserByPhone,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import {
  isValidChinaPhone,
  normalizePhone,
} from "@/lib/ai/sms-service";

const schema = z.object({
  phone: z.string().min(1, "手机号不能为空"),
  purpose: z.enum(["register", "login"]).default("register"),
});

/**
 * POST /api/phone/send-code
 *
 * 发送手机号验证码（Mock 模式）
 *
 * Mock 行为：
 * - 验证码固定为 123456
 * - 不发送真实短信
 * - 直接返回验证码给前端展示
 * - 仍然保存到数据库供后续校验
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

    // Mock 模式：验证码固定为 123456
    const code = "123456";

    // 保存验证码到数据库（供后续校验）
    await createPhoneVerificationCode(phone, code, body.purpose);

    return Response.json(
      {
        success: true,
        // Mock 模式下始终返回验证码
        debugCode: code,
        mockMode: true,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    console.error("[phone/send-code] error:", err);
    return new ChatbotError("bad_request:api").toResponse();
  }
}
