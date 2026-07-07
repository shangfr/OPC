"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { motion } from "motion/react";
import { memo, useMemo } from "react";
import useSWR from "swr";
import {
  buildGroupFromCategory,
  DEFAULT_THEME,
  getAvatarChar,
} from "@/lib/agent-groups";
import { suggestions } from "@/lib/constants";
import type { Agent, Category } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { fetcher } from "@/lib/utils";
import { Suggestion } from "../ai-elements/suggestion";
import type { VisibilityType } from "./visibility-selector";

type CategoryRecord = Category & { sortOrder: number; colorKey: string };

type SuggestedActionsProps = {
  chatId: string;
  sendMessage: UseChatHelpers<ChatMessage>["sendMessage"];
  selectedVisibilityType: VisibilityType;
  agentId?: string | null;
};

function PureSuggestedActions({
  chatId,
  sendMessage,
  agentId,
}: SuggestedActionsProps) {
  const { data: agents } = useSWR<Agent[]>(
    agentId ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/agents` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const { data: categories = [] } = useSWR<CategoryRecord[]>(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/categories`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const { data: siteConfig } = useSWR<{
    defaultStarterQuestions?: string[];
    siteName?: string;
    siteDescription?: string;
  }>(
    agentId
      ? null
      : `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/site-config`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const currentAgent = agentId ? agents?.find((a) => a.id === agentId) : null;

  const agentGroupStyle = useMemo(() => {
    if (!currentAgent?.categoryId) return DEFAULT_THEME;
    const cat = categories.find((c) => c.id === currentAgent.categoryId);
    if (!cat) return DEFAULT_THEME;
    return buildGroupFromCategory(cat);
  }, [currentAgent, categories]);

  const agentQuestions = currentAgent?.starterQuestions ?? null;

  const configQuestions = siteConfig?.defaultStarterQuestions ?? null;

  const suggestedActions =
    agentQuestions && agentQuestions.length > 0
      ? agentQuestions
      : configQuestions && configQuestions.length > 0
        ? configQuestions
        : suggestions;

  const displayName = currentAgent?.name ?? siteConfig?.siteName ?? "OPC Bot";
  const displayDescription =
    currentAgent?.description ??
    siteConfig?.siteDescription ??
    "智能助手，随时为您提供帮助";

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {/* Agent 信息 / 默认品牌信息 */}
      {currentAgent ? (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center"
          initial={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className={`mb-3 flex size-14 items-center justify-center rounded-2xl text-lg font-bold shadow-sm ${agentGroupStyle.bg} ${agentGroupStyle.text}`}
          >
            {getAvatarChar(currentAgent.name)}
          </div>
          <h2 className="text-lg font-semibold tracking-tight">
            {currentAgent.name}
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {currentAgent.description}
          </p>
        </motion.div>
      ) : (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center text-center"
          initial={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <img
            alt={displayName}
            className="mb-3 size-14 rounded-2xl object-cover shadow-sm"
            src="/logo.jpg"
          />
          <h2 className="text-lg font-semibold tracking-tight">
            {displayName}
          </h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {displayDescription}
          </p>
        </motion.div>
      )}

      {/* 引导问题：移动端与桌面端统一 2 列网格，紧凑卡片 + 青色强调 */}
      <div
        className="grid w-full grid-cols-2 gap-2 sm:gap-3"
        data-testid="suggested-actions"
      >
        {suggestedActions.map((suggestedAction, index) => (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="w-full"
            exit={{ opacity: 0, y: 16 }}
            initial={{ opacity: 0, y: 16 }}
            key={suggestedAction}
            transition={{
              delay: 0.06 * index,
              duration: 0.4,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <Suggestion
              className="group/suggestion flex h-full w-full items-start gap-2 whitespace-normal rounded-xl border border-border/60 bg-card/50 px-3 py-2.5 text-left text-[13px] leading-relaxed text-muted-foreground backdrop-blur-sm transition-all duration-200 sm:px-4 sm:py-3 sm:text-[13.5px] hover:-translate-y-0.5 hover:border-cyan-500/40 hover:bg-cyan-500/[0.06] hover:text-foreground hover:shadow-[0_0_20px_var(--accent-glow)]"
              onClick={(suggestion) => {
                window.history.pushState(
                  {},
                  "",
                  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
                );
                sendMessage({
                  role: "user",
                  parts: [{ type: "text", text: suggestion }],
                });
              }}
              suggestion={suggestedAction}
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md bg-cyan-500/10 text-[11px] font-semibold text-cyan-600 transition-colors duration-200 group-hover/suggestion:bg-cyan-500/20 group-hover/suggestion:text-cyan-700 dark:text-cyan-400 dark:group-hover/suggestion:text-cyan-300">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">{suggestedAction}</span>
            </Suggestion>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export const SuggestedActions = memo(
  PureSuggestedActions,
  (prevProps, nextProps) => {
    if (prevProps.chatId !== nextProps.chatId) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.agentId !== nextProps.agentId) {
      return false;
    }

    return true;
  }
);
