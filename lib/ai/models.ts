import { capabilities, models } from "./config";

export type ModelCapabilities = {
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
};

export type ChatModel = {
  id: string;
  name: string;
  provider: string;
  description: string;
  reasoningEffort?: "none" | "minimal" | "low" | "medium" | "high";
};

// ============================================================
// 模型列表
// ============================================================

export const chatModels: ChatModel[] = models;

// 默认聊天模型 — 始终使用列表第一个
export const DEFAULT_CHAT_MODEL = chatModels[0]?.id ?? "glm-4.7-flash";

// 标题生成模型（轻量快速即可）
export const titleModel = {
  id: DEFAULT_CHAT_MODEL,
  name: "Title Model",
  provider: chatModels[0]?.provider ?? "openai",
  description: "用于生成聊天标题",
};

// ============================================================
// 模型能力
// ============================================================

export function getCapabilities(): Record<string, ModelCapabilities> {
  return capabilities;
}

export const isDemo = process.env.IS_DEMO === "1";

export type GatewayModelWithCapabilities = ChatModel & {
  capabilities: ModelCapabilities;
};

export function getAllGatewayModels(): GatewayModelWithCapabilities[] {
  const caps = getCapabilities();
  return chatModels.map((m) => ({
    ...m,
    capabilities: caps[m.id] ?? {
      tools: false,
      vision: false,
      reasoning: false,
    },
  }));
}

export function getActiveModels(): ChatModel[] {
  return chatModels;
}

export const allowedModelIds = new Set(chatModels.map((m) => m.id));

export const modelsByProvider = chatModels.reduce(
  (acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  },
  {} as Record<string, ChatModel[]>
);
