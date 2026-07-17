import { tool } from "ai";
import { z } from "zod";

/**
 * AI 工具：图片生成
 *
 * 调用智谱 AI 的 CogView 图像生成 API 生成图片。
 * 需要配置 ZHIPU_API_KEY 环境变量。
 *
 * 对标：Coze 的「图像生成」插件、Dify 的「文生图」工具
 */
export const generateImage = tool({
  description:
    "根据文字描述生成图片。用户要求画图/生成图片/设计视觉内容时使用。返回图片URL。",
  inputSchema: z.object({
    prompt: z.string().min(1).describe("Detailed description of the image to generate, in the user's language"),
    size: z.enum(["1024x1024", "768x1344", "1344x768"]).default("1024x1024").describe("Image size: square, portrait, or landscape"),
  }),
  execute: async ({ prompt, size }) => {
    try {
      const apiKey = process.env.ZHIPU_API_KEY;
      if (!apiKey) {
        return { success: false, error: "图片生成服务未配置（缺少 ZHIPU_API_KEY）" };
      }

      const response = await fetch("https://open.bigmodel.cn/api/paas/v4/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "cogview-4",
          prompt,
          size,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: `图片生成失败: ${errorData?.error?.message ?? response.statusText}`,
        };
      }

      const data = await response.json();

      if (data?.data?.[0]?.url) {
        return {
          success: true,
          url: data.data[0].url,
          prompt,
          size,
        };
      }

      return { success: false, error: "图片生成返回数据格式异常" };
    } catch {
      return { success: false, error: "图片生成请求失败，请稍后重试" };
    }
  },
});
