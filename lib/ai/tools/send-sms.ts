import { tool } from "ai";
import { z } from "zod";
import { sendGeneralSms } from "../sms-service";
import { isValidChinaPhone, normalizePhone } from "../sms-service";

/**
 * sendSms AI Tool
 *
 * 让 Agent 能够向指定手机号发送通用短信（通知/提醒/营销类）。
 *
 * 设计要点：
 * 1. 复用 lib/ai/sms-service.ts 的 sendGeneralSms 函数，与登录验证码共用基础设施
 * 2. 严格校验中国大陆手机号格式
 * 3. 内容长度限制 500 字符（运营商长短信上限）
 * 4. 返回结构化结果，便于 Agent 后续决策（如发送失败时告知用户）
 * 5. 开发模式（SMS_PROVIDER 未配置）下打印到控制台，不产生真实费用
 *
 * 安全注意：
 * - 生产环境必须配置阿里云 SMS（智谱 SMS 仅支持验证码）
 * - 营销类短信需企业资质 + 模板审核，建议在 chat route 中增加用户二次确认
 * - 建议在 quotas/usage.ts 中增加短信配额限制（如每用户每天 10 条）
 */
export const sendSms = tool({
  description: `向指定手机号发送短信。

适用场景：
- 用户明确要求"发短信通知某人/我自己"
- 工单状态变更、订单完成等需要主动通知用户
- 定时提醒、紧急告警

不适用场景：
- 发送验证码（验证码走登录流程，不通过此工具）
- 群发营销短信（需单独审批流程）

调用前必须：
1. 确认手机号格式正确（中国大陆 11 位手机号）
2. 确认内容简洁清晰（建议 70 字符内，最长 500 字符）
3. 如果是发给用户本人以外的人，先向用户确认收件人和内容`,
  inputSchema: z.object({
    phone: z
      .string()
      .min(11)
      .max(11)
      .describe("中国大陆手机号，11 位数字，如 13800138000"),
    content: z
      .string()
      .min(1)
      .max(500)
      .describe("短信正文内容，建议 70 字符内，最长 500 字符"),
  }),
  execute: async ({ phone, content }) => {
    // 规范化手机号（去除空格、横线、+86 前缀）
    const normalizedPhone = normalizePhone(phone);

    // 二次校验
    if (!isValidChinaPhone(normalizedPhone)) {
      return {
        success: false,
        error: `手机号格式无效: ${phone}。请提供有效的中国大陆 11 位手机号。`,
      };
    }

    if (!content || content.trim().length === 0) {
      return {
        success: false,
        error: "短信内容不能为空",
      };
    }

    try {
      const result = await sendGeneralSms(normalizedPhone, content.trim());

      if (result.success) {
        return {
          success: true,
          messageId: result.messageId,
          phone: normalizedPhone,
          content: content.trim(),
          length: content.trim().length,
          message: `短信已成功发送至 ${normalizedPhone}（消息ID: ${result.messageId}）`,
        };
      }

      return {
        success: false,
        error: result.error || "短信发送失败，请稍后重试",
        phone: normalizedPhone,
      };
    } catch (error) {
      console.error("[sendSms Tool] 发送异常:", error);
      return {
        success: false,
        error: `短信发送异常: ${
          error instanceof Error ? error.message : String(error)
        }`,
        phone: normalizedPhone,
      };
    }
  },
});
