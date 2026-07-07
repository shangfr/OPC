// ============================================================
// AI 模型配置 — 在这里修改模型和厂商，无需改代码
//
// apiKey / baseURL 等敏感信息仍从环境变量读取
// ============================================================

import type { ChatModel, ModelCapabilities } from "./models";

// --- 厂商列表 ---
// key = 厂商标识（模型 provider 字段引用此 key）
export const providers: Record<
  string,
  {
    name: string;
    apiKey: string;
    baseURL: string;
  }
> = {
  zhipuai: {
    name: "zhipu",
    apiKey: process.env.ZHIPU_API_KEY ?? "",
    baseURL:
      process.env.ZHIPU_BASE_URL ?? "https://open.bigmodel.cn/api/paas/v4",
  },
  deepseek: {
    name: "deepseek",
    apiKey: process.env.DEEPSEEK_API_KEY ?? "",
    baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/v1",
  },
  // openai: {
  //   name: "openai",
  //   apiKey: process.env.OPENAI_API_KEY ?? "",
  //   baseURL: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1",
  // },
};

// --- 模型列表 ---
// provider 必须在上面 providers 中已配置
export const models: ChatModel[] = [
  {
    id: "deepseek-v4-flash",
    name: "DeepSeek",
    provider: "deepseek",
    description:
      "‌DeepSeek-V4-Flash‌是深度求索公司于‌2026年4月24日‌发布并开源的AI大模型，定位为 DeepSeek-V4 系列中的‌快速轻量版本‌，主打高效率、低成本，支持 100 万 token 超长上下文处理。",
  },
  {
    id: "glm-4.1v-thinking-flash",
    name: "智谱AI",
    provider: "zhipuai",
    description:
      "智谱免费视觉推理模型，10B级SOTA，支持视频理解、网页Coding、视觉定位",
    reasoningEffort: "medium",
  },
];

// --- 模型能力 ---
// key = 模型 id
export const capabilities: Record<string, ModelCapabilities> = {
  "deepseek-v4-flash": { tools: true, vision: false, reasoning: true },
  "glm-4.1v-thinking-flash": { tools: true, vision: true, reasoning: true },
};
