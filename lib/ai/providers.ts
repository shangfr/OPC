import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";
import { providers } from "./config";
import { type ChatModel, chatModels, DEFAULT_CHAT_MODEL } from "./models";

// ============================================================
// 多厂商 Provider 管理
// 每个模型根据其 provider 字段路由到对应的 API Key / Base URL
// ============================================================

export type ProviderConfig = {
  name: string;
  apiKey: string;
  baseURL: string;
};

// 缓存已创建的 provider 实例
const providerCache = new Map<
  string,
  ReturnType<typeof createOpenAICompatible>
>();

function getOrCreateProvider(name: string) {
  const cached = providerCache.get(name);
  if (cached) {
    return cached;
  }
  const config = providers[name];
  if (!config) {
    throw new Error(
      `Provider "${name}" 未在 config.ts 中配置。可用: ${Object.keys(providers).join(", ")}`
    );
  }
  const instance = createOpenAICompatible({
    name: config.name,
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });
  providerCache.set(name, instance);
  return instance;
}

function buildLanguageModels(models: ChatModel[]) {
  const map: Record<
    string,
    ReturnType<ReturnType<typeof getOrCreateProvider>>
  > = {};
  for (const m of models) {
    const provider = getOrCreateProvider(m.provider);
    map[m.id] = provider(m.id);
  }
  return map;
}

export const myProvider = isTestEnvironment
  ? (() => {
      const { chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "chat-model": chatModel,
          "title-model": titleModel,
        },
      });
    })()
  : customProvider({
      languageModels: buildLanguageModels(chatModels),
    });

export function getLanguageModel(modelId: string) {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel(modelId);
  }

  const model = myProvider?.languageModel?.(modelId);
  if (model) {
    return model;
  }

  // 兜底：查 modelId 对应的 provider
  const modelConfig = chatModels.find((m) => m.id === modelId);
  if (modelConfig) {
    return getOrCreateProvider(modelConfig.provider)(modelId);
  }

  // 最终兜底
  return getOrCreateProvider("openai")(modelId);
}

export function getTitleModel() {
  if (isTestEnvironment && myProvider) {
    return myProvider.languageModel("title-model");
  }
  const defaultModelConfig = chatModels[0];
  const providerName = defaultModelConfig?.provider ?? "openai";
  return getOrCreateProvider(providerName)(DEFAULT_CHAT_MODEL);
}
