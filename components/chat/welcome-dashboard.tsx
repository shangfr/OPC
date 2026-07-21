"use client";

import {
  Bot,
  Sparkles,
  ArrowRight,
  PenSquare,
  Lightbulb,
  Code2,
  FileText,
  Mail,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { getAvatarChar } from "@/lib/agent-groups";
import type { Agent } from "@/lib/db/schema";
import { cn, fetcher, safeSessionStorageSet } from "@/lib/utils";

interface WelcomeDashboardProps {
  onNewChat?: () => void;
  accountType?: "personal" | "enterprise";
  isAdmin?: boolean;
  isEnterpriseAdmin?: boolean;
  userName?: string;
  userEmail?: string;
  userPlan?: string | null;
}

export function WelcomeDashboard({
  onNewChat,
  userName,
  userPlan,
}: WelcomeDashboardProps) {
  const router = useRouter();

  const { data: agents = [] } = useSWR<Agent[]>(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/agents`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const activeAgents = useMemo(
    () => agents.filter((a) => a.isActive),
    [agents]
  );

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 6) return "夜深了";
    if (hour < 11) return "早上好";
    if (hour < 14) return "中午好";
    if (hour < 18) return "下午好";
    return "晚上好";
  }, []);

  const greetingName = userName || "";

  const handleNewChat = useCallback(async () => {
    if (onNewChat) onNewChat();
    try {
      const res = await fetch("/api/chat/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      const { chatId } = await res.json();
      router.push(`/chat/${chatId}`);
    } catch {
      toast.error("创建对话失败，请重试");
    }
  }, [onNewChat, router]);

  const handleStartChatWithPrompt = useCallback(
    async (prompt: string) => {
      if (onNewChat) onNewChat();
      try {
        const res = await fetch("/api/chat/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error("Failed to create chat");
        const { chatId } = await res.json();
        safeSessionStorageSet(`pending-prompt-${chatId}`, prompt);
        router.push(`/chat/${chatId}?prompt=${encodeURIComponent(prompt)}`);
      } catch {
        toast.error("创建对话失败，请重试");
      }
    },
    [onNewChat, router]
  );

  const handleStartChatWithAgent = useCallback(
    async (agent: Agent) => {
      try {
        const res = await fetch("/api/chat/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: agent.id }),
        });
        if (!res.ok) throw new Error("Failed to create chat");
        const { chatId } = await res.json();
        safeSessionStorageSet(`pending-chat-${chatId}`, agent.id);
        router.push(`/chat/${chatId}`);
      } catch {
        toast.error("创建对话失败，请重试");
      }
    },
    [router]
  );

  const quickActions = useMemo(
    () => [
      {
        icon: PenSquare,
        label: "新建对话",
        description: "开始与 AI 助手对话",
        color: "text-sky-500",
        bgColor: "bg-sky-500/10",
        onClick: handleNewChat,
      },
      {
        icon: Bot,
        label: "选择 OPC",
        description: "浏览和管理 OPC 角色",
        color: "text-rose-500",
        bgColor: "bg-rose-500/10",
        onClick: () => router.push("/explore"),
      },
    ],
    [handleNewChat, router]
  );

  const suggestionPrompts = useMemo(
    () => [
      {
        icon: Mail,
        title: "帮我写一封邮件",
        prompt:
          "请帮我写一封正式的工作邮件，主题是申请下周两天年假，语气礼貌简洁。",
      },
      {
        icon: Lightbulb,
        title: "头脑风暴点子",
        prompt: "请帮我头脑风暴 5 个面向年轻人的线下活动创意，要求新颖且可落地。",
      },
      {
        icon: FileText,
        title: "总结一篇文章",
        prompt: "请把下面这段文字总结成 3 个要点：\n\n（在此粘贴需要总结的内容）",
      },
      {
        icon: Code2,
        title: "解释一段代码",
        prompt: "请用通俗易懂的语言解释下面这段代码的作用：\n\n（在此粘贴代码）",
      },
    ],
    []
  );

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto px-4 py-0 md:px-6">
      <div className="w-full max-w-3xl pt-8 pb-8 md:pt-16 md:pb-12">
        {/* ===== Hero 区 ===== */}
        <div className="mb-8 text-center md:mb-12">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-primary/10">
            <img
              alt="OPC Bot"
              className="size-full object-cover"
              src="/logo.jpg"
            />
          </div>
          <p className="mb-2 text-sm font-medium text-primary/80">
            {greeting}
            {greetingName ? `, ${greetingName}` : ""}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            有什么可以帮你？
          </h1>
          <p className="mt-3 text-sm text-muted-foreground md:text-base">
            选择一位 OPC 或直接开始对话，探索 AI 助手的无限可能
          </p>

          {/* 套餐标签 */}
          <div className="mt-4 flex items-center justify-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3" />
              {userPlan === "free" ? "免费版" : userPlan === "creator" ? "创作者版" : userPlan === "team" ? "团队版" : userPlan === "enterprise" ? "企业版" : "免费版"}
            </span>
          </div>
        </div>

        {/* ===== 快捷入口 ===== */}
        <div className="mb-8 grid gap-3 sm:grid-cols-2">
          {quickActions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={cn(
                "group flex items-center gap-4 text-left transition-all duration-300 hover:-translate-y-0.5",
                cardVariants({
                  variant: "base",
                  padding: "lg",
                  className: "hover:shadow-md",
                })
              )}
            >
              <div
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-xl transition-colors",
                  action.bgColor
                )}
              >
                <action.icon className={cn("size-5", action.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{action.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {action.description}
                </p>
              </div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-foreground" />
            </button>
          ))}
        </div>

        {/* ===== 灵感提示词 ===== */}
        <div className="mb-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            灵感提示词
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {suggestionPrompts.map((s) => (
              <button
                key={s.title}
                type="button"
                onClick={() => handleStartChatWithPrompt(s.prompt)}
                className={cn(
                  "group flex items-start gap-3 text-left transition-all duration-300 hover:-translate-y-0.5",
                  cardVariants({
                    variant: "base",
                    padding: "md",
                    className:
                      "hover:border-primary/30 hover:shadow-[0_4px_24px_-4px_rgba(99,102,241,0.15)]",
                  })
                )}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/5">
                  <s.icon className="size-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {s.prompt}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ===== 推荐 OPC ===== */}
        {activeAgents.length > 0 && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                推荐 OPC
              </h2>
              <button
                type="button"
                onClick={() => router.push("/explore")}
                className="text-xs text-primary hover:underline"
              >
                查看全部 →
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {activeAgents.slice(0, 6).map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => handleStartChatWithAgent(agent)}
                  className={cn(
                    "group flex items-center gap-3 text-left transition-all duration-300 hover:-translate-y-0.5",
                    cardVariants({
                      variant: "base",
                      padding: "md",
                      className: "hover:border-primary/30 hover:shadow-md",
                    })
                  )}
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                    {getAvatarChar(agent.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{agent.name}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {agent.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
