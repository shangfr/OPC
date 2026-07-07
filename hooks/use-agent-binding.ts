"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/utils";

type AgentBindingState = {
  agentId: string | null;
  agentName: string | null;
  agentIdRef: React.RefObject<string | null>;
  setAgentId: (id: string | null) => void;
};

/**
 * Manages agent binding for a chat: agentId, agentName, and validation.
 * Handles sessionStorage for pending chats, DB restoration, and cleanup
 * when agents are deleted or deactivated.
 */
export function useAgentBinding({
  chatId,
  chatIdFromUrl,
  isNewChat,
  effectiveData,
}: {
  chatId: string;
  chatIdFromUrl: string | null;
  isNewChat: boolean;
  effectiveData:
    | {
        agentId?: string | null;
        agentName?: string | null;
      }
    | null
    | undefined;
}): AgentBindingState {
  // agentId can come from:
  // 1. sessionStorage (pending chat, not yet saved to DB)
  // 2. effectiveData (DB, after first message)
  const getInitialAgentId = (): string | null => {
    if (chatIdFromUrl && typeof window !== "undefined") {
      const pending = sessionStorage.getItem(`pending-chat-${chatIdFromUrl}`);
      if (pending) {
        return pending;
      }
    }
    return null;
  };

  const [agentId, setAgentIdState] = useState<string | null>(getInitialAgentId);
  const agentIdRef = useRef<string | null>(getInitialAgentId());

  const setAgentId = useCallback((id: string | null) => {
    agentIdRef.current = id;
    setAgentIdState(id);
  }, []);

  // Check if we need agent validation
  const needsAgentValidation = isNewChat ? false : !!effectiveData?.agentId;
  const { data: agentsForValidation } = useSWR(
    needsAgentValidation
      ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/agents`
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  // Validate agentId: clear if the agent was deleted or deactivated.
  useEffect(() => {
    if (needsAgentValidation && agentsForValidation) {
      const agentList: Array<{ id: string; isActive: boolean }> = Array.isArray(
        agentsForValidation
      )
        ? agentsForValidation
        : ((
            agentsForValidation as {
              agents?: Array<{ id: string; isActive: boolean }>;
            }
          ).agents ?? []);
      const match = agentList.find(
        (a) => a.id === effectiveData?.agentId && a.isActive
      );
      if (match) {
        return;
      }
      setAgentId(null);
    }
  }, [
    needsAgentValidation,
    agentsForValidation,
    effectiveData?.agentId,
    setAgentId,
  ]);

  // Derive agentName from effectiveData, falling back to agents list.
  const [agentName, setAgentName] = useState<string | null>(
    isNewChat
      ? null
      : ((effectiveData as { agentName?: string | null })?.agentName ?? null)
  );

  useEffect(() => {
    if (isNewChat) {
      setAgentName(null);
      return;
    }

    // Primary: from effectiveData (cache or API)
    const fromData = (effectiveData as { agentName?: string | null })
      ?.agentName;
    if (fromData !== undefined && fromData !== null) {
      setAgentName(fromData);
      return;
    }

    // Fallback: derive from agents list (already fetched for validation)
    if (effectiveData?.agentId && agentsForValidation) {
      const agentList: Array<{ id: string; name: string }> = Array.isArray(
        agentsForValidation
      )
        ? agentsForValidation
        : ((
            agentsForValidation as {
              agents?: Array<{ id: string; name: string }>;
            }
          ).agents ?? []);
      const match = agentList.find((a) => a.id === effectiveData.agentId);
      if (match?.name) {
        setAgentName(match.name);
        return;
      }
    }

    setAgentName(null);
  }, [isNewChat, effectiveData, agentsForValidation]);

  // Reset agentId when navigating to a different chat.
  useEffect(() => {
    if (!chatIdFromUrl) {
      return;
    }
    const pending = sessionStorage.getItem(`pending-chat-${chatId}`);
    agentIdRef.current = pending ?? null;
    setAgentIdState(pending ?? null);
  }, [chatId, chatIdFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore agentId from chat data (DB) or sessionStorage (pending).
  useEffect(() => {
    if (isNewChat) {
      return;
    }
    if (effectiveData) {
      if (effectiveData.agentId) {
        // DB has a valid agentId - use it and clear pending storage
        setAgentId(effectiveData.agentId);
        sessionStorage.removeItem(`pending-chat-${chatId}`);
      } else {
        // DB doesn't have agentId - check sessionStorage
        const pending = sessionStorage.getItem(`pending-chat-${chatId}`);
        if (pending) {
          setAgentId(pending);
        }
      }
    }
  }, [isNewChat, effectiveData, chatId, setAgentId]);

  return { agentId, agentName, agentIdRef, setAgentId };
}
