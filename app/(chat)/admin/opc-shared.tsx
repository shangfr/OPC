"use client";

import {
  Edit,
  MessageCircle,
  MessageSquare,
  Phone,
  Power,
  PowerOff,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { cardVariants } from "@/components/ui/card";
import {
  type AgentGroupStyle,
  buildGroupFromCategory,
  DEFAULT_THEME,
  getAvatarChar,
} from "@/lib/agent-groups";
import type { Agent, Category } from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";
import { useAgentUsageMap } from "@/hooks/use-agent-usage";

/* ================================================================
 * Category 上下文 —— AgentCard 通过 context 获取分组主题
 * ================================================================ */

type CategoryRecord = Category & { sortOrder: number; colorKey: string };

interface CategoryContextValue {
  categories: CategoryRecord[];
  themeFor: (categoryId: string | null) => AgentGroupStyle;
  labelFor: (categoryId: string | null) => string;
}

const CategoryCtx = createContext<CategoryContextValue>({
  categories: [],
  themeFor: () => DEFAULT_THEME,
  labelFor: () => "未分组",
});

export function useCategoryContext() {
  return useContext(CategoryCtx);
}

/* ================================================================
 * useAgents — 共享数据获取 + 分组逻辑
 * ================================================================ */

const AGENTS_KEY = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/agents`;
const CATEGORIES_KEY = `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/categories`;

export function useAgents() {
  const router = useRouter();

  const {
    data: agents = [],
    isLoading: loading,
    mutate,
  } = useSWR<Agent[]>(AGENTS_KEY, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });

  const { data: categories = [], mutate: mutateCategories } = useSWR<CategoryRecord[]>(
    CATEGORIES_KEY,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );
  /** categoryId → category record */
  const categoryMap = useMemo(() => {
    const map = new Map<string, CategoryRecord>();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  const ctxValue = useMemo<CategoryContextValue>(
    () => ({
      categories,
      themeFor: (catId) => {
        if (!catId) return DEFAULT_THEME;
        const cat = categoryMap.get(catId);
        if (!cat) return DEFAULT_THEME;
        return buildGroupFromCategory(cat);
      },
      labelFor: (catId) => {
        if (!catId) return "未分组";
        return categoryMap.get(catId)?.name ?? "未分组";
      },
    }),
    [categories, categoryMap]
  );

  /** Force re-fetch (used after CRUD operations) */
  const refresh = useCallback(() => {
    mutate();
    mutateCategories(); // 🚨 关键：加上这一行，刷新分类缓存！
  }, [mutate, mutateCategories]);
  /** 用户视图：仅活跃 agent，按分组归类 */
  const userGroups = useMemo(() => {
    const active = agents.filter((a) => a.isActive);
    const inactive = agents.filter((a) => !a.isActive);

    const map = new Map<string, Agent[]>();
    for (const a of active) {
      const key = a.categoryId ?? "__ungrouped__";
      const bucket = map.get(key) ?? [];
      bucket.push(a);
      map.set(key, bucket);
    }

    // Sort categories by sortOrder, build groups
    const groups = categories
      .map((c) => ({
        group: buildGroupFromCategory(c),
        agents: (map.get(c.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
      }))
      .filter((g) => g.agents.length > 0);

    // Ungrouped active agents
    const ungroupedActive = map.get("__ungrouped__") ?? [];
    if (ungroupedActive.length > 0) {
      groups.push({
        group: {
          ...DEFAULT_THEME,
          key: "__ungrouped__",
          label: "未分组",
          order: 999,
        },
        agents: ungroupedActive,
      });
    }

    return { groups, inactive };
  }, [agents, categories]);

  /** 管理视图：所有 agent（含停用），按分组归类 + 未分组 */
  const adminGroups = useMemo(() => {
    const map = new Map<string, Agent[]>();
    const ungrouped: Agent[] = [];

    for (const a of agents) {
      if (a.categoryId) {
        const bucket = map.get(a.categoryId) ?? [];
        bucket.push(a);
        map.set(a.categoryId, bucket);
      } else {
        ungrouped.push(a);
      }
    }

    const groups = categories
      .map((c) => ({
        group: buildGroupFromCategory(c),
        agents: (map.get(c.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
      }))
      .filter((g) => g.agents.length > 0);

    return { groups, ungrouped };
  }, [agents, categories]);

  const activeCount = agents.filter((a) => a.isActive).length;

  /** 按名称/描述搜索活跃 agent */
  const searchAgents = useCallback(
    (query: string): Agent[] => {
      if (!query.trim()) return [];
      const q = query.trim().toLowerCase();
      return agents
        .filter((a) => a.isActive)
        .filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            a.description?.toLowerCase().includes(q)
        );
    },
    [agents]
  );

  const handleStartChat = useCallback(
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
        sessionStorage.setItem(`pending-chat-${chatId}`, agent.id);
        router.push(`/chat/${chatId}`);
      } catch {
        toast.error("创建对话失败，请重试");
      }
    },
    [router]
  );

  return {
    agents,
    categories,
    loading,
    refresh,
    userGroups,
    adminGroups,
    activeCount,
    searchAgents,
    handleStartChat,
    ctxValue,
    setCategories: mutateCategories,
  };
}

/* ================================================================
 * CategoryProvider — 包裹子组件以提供分组 context
 * ================================================================ */

export function CategoryProvider({
  value,
  children,
}: {
  value: CategoryContextValue;
  children: React.ReactNode;
}) {
  return <CategoryCtx.Provider value={value}>{children}</CategoryCtx.Provider>;
}

/* ================================================================
 * GroupHeader — 分组标题（色条 + 名称 + 数量）
 * ================================================================ */

export function GroupHeader({
  group,
  count,
}: {
  group: { bg: string; label: string };
  count: number;
}) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <div aria-hidden className={`h-1 w-6 rounded-full ${group.bg}`} />
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {group.label}
      </h2>
      <span className="text-[10px] text-muted-foreground/50">{count} 个</span>
    </div>
  );
}

/* ================================================================
 * AgentCard — OPC 卡片
 *
 * 默认模式：渐变背景、整体可点击、hover 显示「聊天」操作
 * admin 模式：渐变背景、badge + sortOrder、hover 显示「聊天/编辑/删除」
 * ================================================================ */

export function AgentCard({
  agent,
  admin = false,
  onChat,
  onEdit,
  onDelete,
}: {
  agent: Agent;
  admin?: boolean;
  onChat?: (agent: Agent) => void;
  onEdit?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => void;
}) {
  const { themeFor, labelFor } = useCategoryContext();
  const group = themeFor(agent.categoryId);
  const groupLabel = labelFor(agent.categoryId);
  const avatarChar = getAvatarChar(agent.name);
  // 获取使用统计：SWR 自动去重，多个卡片共享一次请求
  const { usageMap } = useAgentUsageMap();
  const usageCount = usageMap[agent.id] ?? 0;

  return (
    <div
      aria-label={!admin && onChat ? `与 ${agent.name} 开始对话` : undefined}
      className={cn(
        "fade-up group relative overflow-hidden bg-gradient-to-br to-transparent p-5 transition-all duration-300 hover:-translate-y-1",
        cardVariants({
          variant: "elevated",
          padding: "none",
          className: `${group.gradientFrom} ${group.borderHover} ${group.hoverShadow}`,
        })
      )}
      onClick={!admin && onChat ? () => onChat(agent) : undefined}
      onKeyDown={
        !admin && onChat
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onChat(agent);
              }
            }
          : undefined
      }
      role={!admin && onChat ? "button" : undefined}
      tabIndex={!admin && onChat ? 0 : undefined}
    >
      {/* 顶部色条 */}
      <div className={`absolute inset-x-0 top-0 h-1 ${group.bg}`} />

      {/* 头像 + 名称 */}
      <div className="mb-3 mt-1.5 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-base font-bold shadow-sm ${group.bg} ${group.text}`}
          >
            {avatarChar}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold leading-tight">
              {agent.name}
            </h3>
            <div className="mt-0.5 flex items-center gap-2 text-[10px]">
              {admin && (
                <>
                  <span className="text-muted-foreground">
                    #{agent.sortOrder}
                  </span>
                  {agent.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
                      ★ 默认
                    </span>
                  )}
                </>
              )}
              <span className={`font-medium ${group.softText}`}>
                {groupLabel}
              </span>
            </div>
          </div>
        </div>

        {/* 管理视图：启用/停用 badge */}
        {admin && (
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              agent.isActive
                ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {agent.isActive ? (
              <Power className="size-2.5" />
            ) : (
              <PowerOff className="size-2.5" />
            )}
            {agent.isActive ? "启用" : "停用"}
          </span>
        )}
      </div>

      {/* 描述 */}
      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
        {agent.description}
      </p>

      {/* 使用统计 Badge：展示该 Agent 关联的对话数量，帮助 OPC 用户识别高频 Agent */}
      <div className="mb-3 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            usageCount > 0
              ? "bg-blue-500/10 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400"
              : "bg-muted text-muted-foreground/60"
          }`}
          title={`该 Agent 已被使用 ${usageCount} 次`}
        >
          <MessageSquare className="size-2.5" />
          {usageCount > 0 ? `${usageCount} 次对话` : "暂无对话"}
        </span>
      </div>

      {/* hover 行动栏 — 移动端始终可见，桌面端 hover 显示 */}
      <div className="flex items-center justify-between opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        {admin ? (
          /* 管理操作 */
          <>
            <button
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${group.soft} ${group.softText} hover:bg-foreground/10`}
              disabled={!agent.isActive}
              onClick={(e) => {
                e.stopPropagation();
                onChat?.(agent);
              }}
              type="button"
            >
              <MessageCircle className="size-3" />
              聊天
            </button>
            {agent.phone && (
              <a
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${group.soft} ${group.softText} hover:bg-foreground/10`}
                href={`tel:${agent.phone}`}
                onClick={(e) => e.stopPropagation()}
                type="button"
              >
                <Phone className="size-3" />
                电话
              </a>
            )}
            <div className="flex items-center gap-1">
              <button
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${group.soft} ${group.softText} hover:bg-foreground/10`}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.(agent);
                }}
                type="button"
              >
                <Edit className="size-3" />
                编辑
              </button>
              <button
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-destructive/70 transition-colors hover:bg-destructive/10 hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(agent);
                }}
                type="button"
              >
                <Trash2 className="size-3" />
                删除
              </button>
            </div>
          </>
        ) : (
          /* 用户操作 */
          <>
            <span className="text-[10px] text-muted-foreground">
              点击开始对话
            </span>
            <div className="flex items-center gap-1">
              {agent.phone && (
                <a
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${group.soft} ${group.softText} hover:bg-foreground/10 active:bg-foreground/20 cursor-pointer`}
                  href={`tel:${agent.phone}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Phone className="size-3" />
                  电话
                </a>
              )}
              <button
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${group.soft} ${group.softText} hover:bg-foreground/10 active:bg-foreground/20 cursor-pointer`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChat?.(agent);
                }}
                type="button"
              >
                <MessageCircle className="size-3" />
                聊天
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
