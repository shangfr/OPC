import "server-only";

import crypto from "node:crypto";

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
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += crypto.randomInt(0, 10).toString();
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
// biome-ignore lint/suspicious/useAwait: async 签名保持一致性，开发模式无需 await
export async function sendVerificationSms(
  phone: string,
  code: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // 生产模式：如果配置了短信 API 密钥，则调用真实服务
  const smsProvider = process.env.SMS_PROVIDER;

  if (smsProvider === "zhipu") {
    return sendViaZhipu(phone, code);
  }

  if (smsProvider === "aliyun") {
    return sendViaAliyun(phone, code);
  }

  // 开发模式：打印到控制台（不发送真实短信）
  console.log("\n📱 [SMS 验证码 - 开发模式]");
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
async function sendViaZhipu(
  phone: string,
  code: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.ZHIPU_SMS_API_KEY;
  if (!apiKey) {
    return { success: false, error: "ZHIPU_SMS_API_KEY 未配置" };
  }

  try {
    const response = await fetch(
      "https://open.bigmodel.cn/api/paas/v4/sms/verification-code",
      {
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
      }
    );

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: `智谱 SMS 发送失败: ${response.status} ${text}`,
      };
    }

    const data = await response.json();
    return { success: true, messageId: data.id ?? data.messageId };
  } catch (err) {
    return {
      success: false,
      error: `智谱 SMS 请求异常: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 阿里云 SMS 发送（预留）
 * 需安装 @alicloud/dysmsapi20170525 SDK
 */
// biome-ignore lint/suspicious/useAwait: 预留实现，未来接入 SDK 后会有 await
async function sendViaAliyun(
  phone: string,
  code: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // 预留实现：实际部署时安装阿里云 SDK 并实现
  console.log(`[阿里云 SMS - 预留] 发送验证码到 ${phone}: ${code}`);
  return { success: true, messageId: `aliyun-stub-${Date.now()}` };
}

// ============================================================
// 通用短信发送（Agent Tool 使用，支持通知/营销类短信）
// ============================================================

/** 通用短信发送结果 */
export interface SmsSendResult {
  /** 开发模式下的模拟内容（便于调试） */
  debug?: { phone: string; content: string };
  error?: string;
  messageId?: string;
  success: boolean;
}

/**
 * 发送通用短信（非验证码场景，如通知、提醒、营销）
 *
 * 与 sendVerificationSms 的区别：
 * - 验证码短信：走智谱 SMS 验证码专用接口（仅限 4-6 位数字）
 * - 通用短信：走阿里云 SMS 模板短信（需企业资质 + 模板审核）
 *
 * 生产环境必须配置：
 * - SMS_PROVIDER=aliyun
 * - ALIYUN_SMS_ACCESS_KEY_ID / ALIYUN_SMS_ACCESS_KEY_SECRET
 * - ALIYUN_SMS_SIGN_NAME（短信签名，如"OPC平台"）
 * - ALIYUN_SMS_TEMPLATE_CODE（通用通知模板，如"SMS_123456789"）
 *
 * 模板变量约定：通用通知模板使用 ${content} 变量
 */
// biome-ignore lint/suspicious/useAwait: async 签名保持一致性，开发模式无需 await
export async function sendGeneralSms(
  phone: string,
  content: string
): Promise<SmsSendResult> {
  // 内容长度校验（单条短信 70 字符，长短信最多 500 字符）
  if (content.length > 500) {
    return { success: false, error: "短信内容超过 500 字符上限" };
  }

  const smsProvider = process.env.SMS_PROVIDER;

  // 开发模式：打印到控制台
  if (!smsProvider || smsProvider === "dev") {
    console.log("\n📱 [通用短信 - 开发模式]");
    console.log(`  手机号: ${phone}`);
    console.log(`  内容: ${content}`);
    console.log(`  字数: ${content.length}`);
    console.log(`  时间: ${new Date().toISOString()}\n`);
    return {
      success: true,
      messageId: `dev-${Date.now()}`,
      debug: { phone, content },
    };
  }

  // 阿里云通用短信
  if (smsProvider === "aliyun") {
    return sendGeneralViaAliyun(phone, content);
  }

  // 智谱 SMS 仅支持验证码，通用短信回退到开发模式
  if (smsProvider === "zhipu") {
    console.warn("[SMS] 智谱 SMS 仅支持验证码，通用短信需配置阿里云 SMS");
    console.log("\n📱 [通用短信 - 智谱降级开发模式]");
    console.log(`  手机号: ${phone}`);
    console.log(`  内容: ${content}\n`);
    return {
      success: true,
      messageId: `zhipu-fallback-${Date.now()}`,
      debug: { phone, content },
    };
  }

  return { success: false, error: `未知的 SMS_PROVIDER: ${smsProvider}` };
}

/**
 * 阿里云通用短信发送（真实实现，REST API + RPC V1.0 签名）
 *
 * 采用纯 fetch + crypto 签名，无需安装 @alicloud/dysmsapi20170525 SDK，
 * 与项目 lib/storage/oss.ts 的实现风格保持一致，减少依赖。
 *
 * 签名算法：阿里云 RPC API V1.0
 * 文档：https://help.aliyun.com/document_detail/315526.html
 *
 * 环境变量：
 * - ALIYUN_SMS_ACCESS_KEY_ID: AccessKey ID
 * - ALIYUN_SMS_ACCESS_KEY_SECRET: AccessKey Secret
 * - ALIYUN_SMS_SIGN_NAME: 短信签名（如"OPC平台"）
 * - ALIYUN_SMS_TEMPLATE_CODE: 短信模板 Code（如"SMS_123456789"）
 *
 * 模板变量约定：通用通知模板使用 ${content} 变量
 */
async function sendGeneralViaAliyun(
  phone: string,
  content: string
): Promise<SmsSendResult> {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;

  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    return {
      success: false,
      error:
        "阿里云通用短信未完整配置（需 ALIYUN_SMS_ACCESS_KEY_ID / SECRET / SIGN_NAME / TEMPLATE_CODE）",
    };
  }

  try {
    // 构造业务参数
    const businessParams: Record<string, string> = {
      PhoneNumbers: phone,
      SignName: signName,
      TemplateCode: templateCode,
      TemplateParam: JSON.stringify({ content }),
      // OutId: 外部流水号，可用于幂等性
      OutId: `opc-${Date.now()}`,
    };

    const result = await aliyunRpcRequest(
      "dysmsapi.aliyuncs.com",
      "SendSms",
      businessParams,
      accessKeyId,
      accessKeySecret
    );

    if (result.Code === "OK") {
      return {
        success: true,
        messageId: result.BizId,
      };
    }

    return {
      success: false,
      error: `阿里云 SMS 发送失败: ${result.Code} - ${result.Message || "未知错误"}`,
    };
  } catch (err) {
    return {
      success: false,
      error: `阿里云 SMS 请求异常: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 阿里云 RPC API V1.0 通用请求
 *
 * 签名步骤：
 * 1. 构造规范化请求字符串（参数按字典序排序 + URL 编码）
 * 2. 构造待签名字符串：GET&%2F&<URL编码的规范化请求字符串>
 * 3. HMAC-SHA1 计算签名，Base64 编码
 *
 * 文档：https://help.aliyun.com/document_detail/315526.html
 */
async function aliyunRpcRequest(
  host: string,
  action: string,
  businessParams: Record<string, string>,
  accessKeyId: string,
  accessKeySecret: string
): Promise<{
  Code: string;
  Message?: string;
  BizId?: string;
  RequestId?: string;
}> {
  // 公共参数
  const publicParams: Record<string, string> = {
    Action: action,
    Version: "2017-05-25",
    Format: "JSON",
    AccessKeyId: accessKeyId,
    SignatureMethod: "HMAC-SHA1",
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    SignatureVersion: "1.0",
    SignatureNonce: `${Date.now()}${Math.floor(Math.random() * 10_000)}`,
  };

  // 合并参数
  const allParams = { ...publicParams, ...businessParams };

  // 1. 构造规范化请求字符串（按 key 字典序排序）
  const sortedKeys = Object.keys(allParams).sort();
  const canonicalQuery = sortedKeys
    .map(
      (key) =>
        `${aliyunPercentEncode(key)}=${aliyunPercentEncode(allParams[key])}`
    )
    .join("&");

  // 2. 构造待签名字符串
  const stringToSign = `GET&%2F&${aliyunPercentEncode(canonicalQuery)}`;

  // 3. 计算签名（HMAC-SHA1，key 末尾加 &）
  const signature = crypto
    .createHmac("sha1", `${accessKeySecret}&`)
    .update(stringToSign)
    .digest("base64");

  // 4. 拼接最终 URL
  const url = `https://${host}/?${canonicalQuery}&Signature=${aliyunPercentEncode(signature)}`;

  const response = await fetch(url, {
    method: "GET",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 200)}`);
  }

  return await response.json();
}

/**
 * 阿里云 RPC 规范的 URL 编码
 *
 * 与标准 encodeURIComponent 的区别：
 * - + 编码为 %20（而非 +）
 * - * 编码为 %2A
 * - %7E 还原为 ~
 */
function aliyunPercentEncode(str: string): string {
  return encodeURIComponent(str)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~");
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
