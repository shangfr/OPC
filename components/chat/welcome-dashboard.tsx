"use client";

import { Bot, DollarSign, MessageSquare, ShoppingCart, Sparkles } from "lucide-react";
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
  /** 登录用户名（用于首页问候语） */
  userName?: string;
  /** 登录用户邮箱（用于问候语兜底） */
  userEmail?: string;
  /** 用户套餐（free/creator/team/enterprise） */
  userPlan?: string | null;
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
                : "text-destructive"
            }`}
          >
            {trend.up ? "↑" : "↓"} {trend.value}
          </p>
        )}
      </div>
    </div>
  );
}

export function WelcomeDashboard({
  onNewChat,
  accountType = "personal",
  isAdmin = false,
  isEnterpriseAdmin = false,
  userName,
  userEmail,
  userPlan,
}: WelcomeDashboardProps) {
  const router = useRouter();

  // 套餐驱动型权限
  const plan = userPlan ?? "free";
  const canCreateOpc = plan === "creator" || plan === "team" || plan === "enterprise" || isAdmin;

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

  // 根据当前时间生成问候语（参考 ChatGPT / Claude 首页问候风格）
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 6) return "夜深了";
    if (hour < 11) return "早上好";
    if (hour < 14) return "中午好";
    if (hour < 18) return "下午好";
    return "晚上好";
  }, []);

  // 问候对象：优先用户名，其次邮箱前缀
  const greetingName = useMemo(() => {
    if (userName && userName.trim()) return userName.trim();
    if (userEmail) {
      const prefix = userEmail.split("@")[0];
      return prefix;
    }
    return undefined;
  }, [userName, userEmail]);

  // 一键发起带预设提示词的新对话：创建会话后通过 ?query= 参数自动发送
  const handleStartChatWithPrompt = useCallback(
    async (prompt: string) => {
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
        router.push(`/chat/${chatId}?query=${encodeURIComponent(prompt)}`);
      } catch {
        toast.error("创建对话失败，请重试");
      }
    },
    [onNewChat, router]
  );

  // 首页推荐提示词（参考主流大模型聊天平台的快捷指令卡片）
  const suggestionPrompts = useMemo(
    () => [
      { icon: "\u270d\ufe0f", title: "帮我写一封邮件", prompt: "请帮我写一封正式的工作邮件，主题是申请下周两天年假，语气礼貌简洁。" },
      { icon: "\ud83d\udca1", title: "头脑风暴点子", prompt: "请帮我头脑风暴 5 个面向年轻人的线下活动创意，要求新颖且可落地。" },
      { icon: "\ud83d\udcca", title: "总结一篇文章", prompt: "请把下面这段文字总结成 3 个要点：\n\n（在此粘贴需要总结的内容）" },
      { icon: "\ud83d\udcbb", title: "解释一段代码", prompt: "请用通俗易懂的语言解释下面这段代码的作用：\n\n（在此粘贴代码）" },
    ],
    []
  );

  return (
    <div className="flex h-full flex-col items-center overflow-y-auto px-4 py-0 md:px-6">
      <div className="w-full max-w-3xl pt-6 pb-6 md:pt-12 md:pb-8">
        {/* ===== Welcome 标题 ===== */}
        <div className="mb-6 text-center md:mb-10">
          {/* 时间问候语（参考 ChatGPT / Claude 首页） */}
          <p className="mb-3 text-sm font-medium text-primary/80">
            {greeting}
            {greetingName ? `, ${greetingName}` : ""} 
          </p>

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

          {/* 套餐信息横幅：显示当前套餐与功能权限 */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Sparkles className="size-3.5" />
              {(() => {
                const plan = userPlan || "free";
                const labels: Record<string, string> = { free: "Free", creator: "Creator", team: "Team", enterprise: "Enterprise" };
                return labels[plan] ?? "Free";
              })()} 套餐
            </span>
            <span className="text-xs text-muted-foreground">
              {canCreateOpc
                ? "可创建 OPC 并获得收益分成"
                : "升级套餐解锁 OPC 创建、收益分成等功能"}
            </span>
          </div>
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

        {/* ===== 灵感提示词（一键发起对话，参考 ChatGPT / Claude 首页快捷指令） ===== */}
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
                <span className="mt-0.5 text-lg leading-none">{s.icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{s.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {s.prompt}
                  </p>
                </div>
                <svg
                  className="mt-1 size-3.5 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-primary"
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
            ))}
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
