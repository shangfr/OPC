"use client";

import { Bot, DollarSign, MessageSquare, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { cardVariants } from "@/components/ui/card";
import {
  buildGroupFromCategory,
  DEFAULT_THEME,
  getAvatarChar,
} from "@/lib/agent-groups";
import type { Agent, Category } from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";

type CategoryRecord = Category & { sortOrder: number; colorKey: string };

interface WelcomeDashboardProps {
  /** 可选：父组件额外操作（仅在 ChatShell 嵌入时使用） */
  onNewChat?: () => void;
  /** 从 Server Component 传入的 session 信息 */
  accountType?: "personal" | "enterprise";
  isAdmin?: boolean;
  /** 企业团队管理员（owner/admin） */
  isEnterpriseAdmin?: boolean;
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  delay,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  trend?: { value: string; up: boolean };
  delay: number;
  color: string;
}) {
  const colorMap: Record<string, { bg: string; icon: string }> = {
    cyan: { bg: "bg-sky-500/10", icon: "text-sky-500" },
    orange: { bg: "bg-orange-500/10", icon: "text-orange-500" },
    amber: { bg: "bg-amber-500/10", icon: "text-amber-500" },
    green: { bg: "bg-emerald-500/10", icon: "text-emerald-500" },
  };
  const c = colorMap[color] ?? colorMap.cyan;

  return (
    <div
      className={cn(
        "stat-enter flex items-center gap-4",
        cardVariants({ variant: "base", padding: "md" })
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <div
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${c.bg}`}
      >
        <Icon className={`size-4 ${c.icon}`} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-lg font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        {trend && (
          <p
            className={`mt-0.5 text-[11px] ${
              trend.up
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-500"
            }`}
          >
            {trend.up ? "↑" : "↓"} {trend.value}
          </p>
        )}
      </div>
    </div>
  );
}

export function WelcomeDashboard({ onNewChat, accountType = "personal", isAdmin = false }: WelcomeDashboardProps) {
  const router = useRouter();

  const { data: agents = [], isLoading: agentsLoading } = useSWR<Agent[]>(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/agents`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const { data: siteConfig = null } = useSWR<{
    siteName?: string | null;
    siteDescription?: string | null;
  } | null>(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/site-config`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const { data: categories = [] } = useSWR<CategoryRecord[]>(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/categories`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  const activeAgents = useMemo(
    () => agents.filter((a) => a.isActive),
    [agents]
  );

  const defaultAgent = useMemo(() => agents.find((a) => a.isDefault), [agents]);

  // 按分组选出推荐代表（每组至多 2 个，按 category sortOrder 排列）
  const featuredAgents = useMemo(() => {
    const catMap = new Map<string, CategoryRecord>();
    for (const c of categories) catMap.set(c.id, c);

    const map = new Map<string, Agent[]>();
    for (const a of activeAgents) {
      const key = a.categoryId ?? "__ungrouped__";
      const bucket = map.get(key) ?? [];
      if (bucket.length < 2) {
        bucket.push(a);
        map.set(key, bucket);
      }
    }

    const result: Agent[] = [];
    for (const cat of categories) {
      const bucket = map.get(cat.id) ?? [];
      result.push(...bucket.slice(0, 2));
      if (result.length >= 8) break;
    }
    // Add ungrouped if still under 8
    if (result.length < 8) {
      const ungrouped = map.get("__ungrouped__") ?? [];
      result.push(...ungrouped.slice(0, 8 - result.length));
    }
    return result.slice(0, 8);
  }, [activeAgents, categories]);

  const handleNewChat = useCallback(async () => {
    if (onNewChat) {
      onNewChat();
    }
    try {
      const res = await fetch("/api/chat/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error("Failed to create chat");
      }
      const { chatId, agentId } = await res.json();
      if (agentId) {
        sessionStorage.setItem(`pending-chat-${chatId}`, agentId);
      }
      router.push(`/chat/${chatId}`);
    } catch {
      toast.error("创建对话失败，请重试");
    }
  }, [onNewChat, router]);

  const handleStartChatWithAgent = useCallback(
    async (agent: Agent) => {
      try {
        const res = await fetch("/api/chat/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: agent.id }),
        });
        if (!res.ok) {
          throw new Error("Failed to create chat");
        }
        const { chatId } = await res.json();
        // Store agentId temporarily for page initialization
        sessionStorage.setItem(`pending-chat-${chatId}`, agent.id);
        router.push(`/chat/${chatId}`);
      } catch {
        toast.error("创建对话失败，请重试");
      }
    },
    [router]
  );

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-4 py-0 md:px-6">
      <div className="w-full max-w-3xl pt-6 pb-6 md:pt-12 md:pb-8">
        {/* ===== Welcome 标题 ===== */}
        <div className="mb-6 text-center md:mb-10">
          <div className="mx-auto mb-5 flex size-16 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-primary/10">
            {defaultAgent ? (
              <span className="flex size-full items-center justify-center text-xl font-bold text-foreground">
                {getAvatarChar(defaultAgent.name)}
              </span>
            ) : (
              <img
                alt="OPC Bot"
                className="size-full object-cover"
                src="/logo.jpg"
              />
            )}
          </div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            {defaultAgent
              ? defaultAgent.name
              : siteConfig?.siteName || "OPC Bot"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {defaultAgent
              ? defaultAgent.description
              : siteConfig?.siteDescription ||
                "选择一位 OPC 或直接开始对话，探索 AI 助手的无限可能"}
          </p>
        </div>

        {/* ===== 快速开始 ===== */}
        <div className="mb-8">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            快速开始
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              className={cn(
                "group relative flex items-center gap-4 overflow-hidden bg-gradient-to-br to-transparent text-left transition-all duration-300 hover:-translate-y-0.5",
                cardVariants({
                  variant: "base",
                  padding: "lg",
                  className:
                    "from-sky-500/[0.04] hover:border-sky-500/30 hover:shadow-[0_4px_24px_-4px_rgba(14,165,233,0.15)]",
                })
              )}
              onClick={handleNewChat}
              type="button"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sky-500/10 transition-colors group-hover:bg-sky-500/15">
                <MessageSquare className="size-5 text-sky-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">开始对话</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  直接与 AI 开始对话
                </p>
              </div>
              <svg
                className="size-4 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-sky-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 5l7 7-7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              className={cn(
                "group relative flex items-center gap-4 overflow-hidden bg-gradient-to-br to-transparent text-left transition-all duration-300 hover:-translate-y-0.5",
                cardVariants({
                  variant: "base",
                  padding: "lg",
                  className:
                    "from-rose-500/[0.04] hover:border-rose-500/30 hover:shadow-[0_4px_24px_-4px_rgba(244,63,94,0.15)]",
                })
              )}
              onClick={() => router.push("/explore")}
              type="button"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 transition-colors group-hover:bg-rose-500/15">
                <Bot className="size-5 text-rose-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">选择 OPC</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  浏览和管理 OPC 角色
                </p>
              </div>
              <svg
                className="size-4 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-rose-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 5l7 7-7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* 第三个快捷入口：按角色显示 */}
            <button
              className={cn(
                "group relative flex items-center gap-4 overflow-hidden bg-gradient-to-br to-transparent text-left transition-all duration-300 hover:-translate-y-0.5",
                cardVariants({
                  variant: "base",
                  padding: "lg",
                  className:
                    "from-violet-500/[0.04] hover:border-violet-500/30 hover:shadow-[0_4px_24px_-4px_rgba(139,92,246,0.15)]",
                })
              )}
              onClick={() => {
                if (isAdmin) {
                  router.push("/admin/stats");
                } else if (accountType === "enterprise") {
                  router.push("/marketplace");
                } else {
                  router.push("/creator");
                }
              }}
              type="button"
            >
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 transition-colors group-hover:bg-violet-500/15">
                {isAdmin ? (
                  <Bot className="size-5 text-violet-500" />
                ) : accountType === "enterprise" ? (
                  <ShoppingCart className="size-5 text-violet-500" />
                ) : (
                  <DollarSign className="size-5 text-violet-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {isAdmin ? "数据看板" : accountType === "enterprise" ? "交易市场" : "创作者中心"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {isAdmin ? "查看平台运营数据" : accountType === "enterprise" ? "浏览订阅 OPC 服务" : "管理收益和 OPC 上架"}
                </p>
              </div>
              <svg
                className="size-4 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-violet-500"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  d="M9 5l7 7-7 7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* ===== 推荐 OPC ===== */}
        {agentsLoading && featuredAgents.length === 0 && (
          <div>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              推荐 OPC
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  className={cn(
                    "flex items-center gap-4 overflow-hidden",
                    cardVariants({ variant: "base", padding: "md" })
                  )}
                  key={`skeleton-${i}`}
                >
                  <div className="size-10 shrink-0 animate-pulse rounded-xl bg-foreground/10" />
                  <div className="min-w-0 flex-1">
                    <div className="h-4 w-24 animate-pulse rounded bg-foreground/10" />
                    <div className="mt-1.5 h-3 w-36 animate-pulse rounded bg-foreground/8" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {featuredAgents.length > 0 && (
          <div>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              推荐 OPC
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {featuredAgents.map((agent, i) => {
                const cat = agent.categoryId
                  ? categories.find((c) => c.id === agent.categoryId)
                  : null;
                const group = cat
                  ? buildGroupFromCategory(cat)
                  : {
                      ...DEFAULT_THEME,
                      key: "__none__",
                      label: "未分组",
                      order: 999,
                    };
                const avatarChar = getAvatarChar(agent.name);

                return (
                  <button
                    className={cn(
                      "stat-enter group flex items-center gap-4 overflow-hidden bg-gradient-to-br to-transparent text-left transition-all duration-300 hover:-translate-y-0.5",
                      cardVariants({
                        variant: "base",
                        padding: "md",
                        className: `${group.gradientFrom} ${group.borderHover} ${group.hoverShadow}`,
                      })
                    )}
                    key={agent.id}
                    onClick={() => handleStartChatWithAgent(agent)}
                    style={{
                      animationDelay: `${300 + i * 80}ms`,
                      animationFillMode: "both",
                    }}
                    type="button"
                  >
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold shadow-sm transition-transform group-hover:scale-105 ${group.bg} ${group.text}`}
                    >
                      {avatarChar}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {agent.name}
                      </p>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {agent.description || "点击开始对话"}
                      </p>
                    </div>
                    <svg
                      className="size-4 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-foreground"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M9 5l7 7-7 7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                );
              })}
            </div>

            {/* 查看更多 */}
            {activeAgents.length > featuredAgents.length && (
              <button
                className="mt-4 w-full rounded-xl border border-dashed border-border/50 py-2.5 text-center text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
                onClick={() => router.push("/explore")}
                type="button"
              >
                查看全部 {activeAgents.length} 个 OPC →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
