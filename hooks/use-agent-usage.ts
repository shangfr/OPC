"use client";

import useSWR from "swr";
import { fetcher } from "@/lib/utils";

/**
 * useAgentUsageMap
 *
 * 获取所有 Agent 的对话使用数量统计。
 * 返回一个 agentId -> chatCount 的映射表。
 *
 * SWR 会自动去重相同 key 的请求，因此在多个 AgentCard 中
 * 同时调用本 hook 也只会发起一次实际请求。
 *
 * OPC 场景下，使用统计帮助一人公司用户识别高频使用的 Agent，
 * 从而优化资源配置与提示词调优方向。
 */
export function useAgentUsageMap() {
  const { data, error, isLoading } = useSWR<Record<string, number>>(
    "/api/agents/usage",
    fetcher,
    {
      // 60 秒内不重复请求；窗口失焦时自动重新验证
      dedupingInterval: 60_000,
      revalidateOnFocus: false,
    },
  );

  return {
    usageMap: data ?? {},
    isLoading,
    error,
  };
}
