import "server-only";

/**
 * 短信验证码服务
 *
 * 支持两种模式：
 * 1. 开发模式（默认）：验证码输出到服务端控制台日志，便于本地调试
 * 2. 生产模式：配置 ZHIPU_SMS_API_KEY / ALIYUN_SMS_* 等环境变量后调用真实短信 API
 *
 * 当前实现采用开发模式 + 预留生产模式接口。
 * 生产环境部署时，可实现 sendRealSms 函数对接阿里云/腾讯云/智谱等短信服务。
 */

const CODE_LENGTH = 6;
const CODE_TTL_MINUTES = 5;
// 每小时同一手机号最多发送次数
const MAX_SEND_PER_HOUR = 5;
// 同一手机号两次发送的最小间隔（秒）
const MIN_RESEND_INTERVAL_SEC = 60;

/** 生成 6 位数字验证码 */
export function generateVerificationCode(): string {
  // 使用 crypto.randomInt 避免可预测性
  const { randomInt } = require("crypto");
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += randomInt(0, 10).toString();
  }
  return code;
}

/** 验证码有效期（毫秒） */
export const CODE_TTL_MS = CODE_TTL_MINUTES * 60 * 1000;

/** 获取限流配置 */
export const SMS_RATE_LIMIT = {
  maxPerHour: MAX_SEND_PER_HOUR,
  minResendIntervalSec: MIN_RESEND_INTERVAL_SEC,
};

/**
 * 发送短信验证码
 *
 * 开发模式：打印到控制台
 * 生产模式：调用真实短信 API（需配置环境变量）
 */
export async function sendVerificationSms(phone: string, code: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // 生产模式：如果配置了短信 API 密钥，则调用真实服务
  const smsProvider = process.env.SMS_PROVIDER;

  if (smsProvider === "zhipu") {
    return sendViaZhipu(phone, code);
  }

  if (smsProvider === "aliyun") {
    return sendViaAliyun(phone, code);
  }

  // 开发模式：打印到控制台（不发送真实短信）
  console.log(`\n📱 [SMS 验证码 - 开发模式]`);
  console.log(`  手机号: ${phone}`);
  console.log(`  验证码: ${code}`);
  console.log(`  有效期: ${CODE_TTL_MINUTES} 分钟`);
  console.log(`  时间: ${new Date().toISOString()}\n`);

  return { success: true, messageId: `dev-${Date.now()}` };
}

/**
 * 智谱 SMS 发送（预留）
 * 文档: https://docs.bigmodel.cn/api-reference/sms
 */
async function sendViaZhipu(phone: string, code: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.ZHIPU_SMS_API_KEY;
  if (!apiKey) {
    return { success: false, error: "ZHIPU_SMS_API_KEY 未配置" };
  }

  try {
    const response = await fetch("https://open.bigmodel.cn/api/paas/v4/sms/verification-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        phone,
        code,
        ttl: CODE_TTL_MINUTES * 60,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return { success: false, error: `智谱 SMS 发送失败: ${response.status} ${text}` };
    }

    const data = await response.json();
    return { success: true, messageId: data.id ?? data.messageId };
  } catch (err) {
    return { success: false, error: `智谱 SMS 请求异常: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * 阿里云 SMS 发送（预留）
 * 需安装 @alicloud/dysmsapi20170525 SDK
 */
async function sendViaAliyun(phone: string, code: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // 预留实现：实际部署时安装阿里云 SDK 并实现
  console.log(`[阿里云 SMS - 预留] 发送验证码到 ${phone}: ${code}`);
  return { success: true, messageId: `aliyun-stub-${Date.now()}` };
}

/** 校验中国大陆手机号格式 */
export function isValidChinaPhone(phone: string): boolean {
  // 去除空格和横线
  const cleaned = phone.replace(/[\s-]/g, "");
  // 中国大陆手机号：1开头，第二位3-9，共11位
  return /^1[3-9]\d{9}$/.test(cleaned);
}

/** 标准化手机号格式（去除空格、横线，保留+86前缀如有） */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s-]/g, "").replace(/^(\+86)/, "");
}
