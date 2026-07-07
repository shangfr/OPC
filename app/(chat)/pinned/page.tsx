"use client";

import { formatDistance } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Loader2,
  MessageSquare,
  Pin,
  PinOff,
  Search,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";

import { getAvatarChar } from "@/lib/agent-groups";
import type { Agent } from "@/lib/db/schema";
import { cn, fetcher, generateUUID } from "@/lib/utils"; // 🚨 修改：引入 generateUUID
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type PinnedChat = {
  id: string;
  title: string;
  createdAt: string;
  pinnedAt: string;
  agentId: string | null;
  agentName: string | null;
};

export default function PinnedPage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();

  const { data, isLoading } = useSWR<{ chats: PinnedChat[] }>(
    "/api/history?pinned=1&limit=100",
    fetcher
  );

  const { data: agentsData } = useSWR<Agent[]>("/api/agents", fetcher, {
    revalidateOnFocus: false,
  });

  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [unpinningId, setUnpinningId] = useState<string | null>(null);

  const chats = data?.chats ?? [];

  const activeAgents = useMemo(
    () => (agentsData ?? []).filter((a) => a.isActive),
    [agentsData]
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return chats;
    const q = search.trim().toLowerCase();
    return chats.filter(
      (c) =>
        c.title?.toLowerCase().includes(q) ||
        c.agentName?.toLowerCase().includes(q)
    );
  }, [chats, search]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(filtered.map((m) => m.id)));
  };

  const clearSelection = () => {
    setSelected(new Set());
  };

  const handleUnpin = async (chatId: string) => {
    setUnpinningId(chatId);
    try {
      const res = await fetch(`/api/chat?id=${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: false }),
      });
      if (!res.ok) throw new Error("Failed to unpin");

      mutate("/api/history?pinned=1&limit=100");
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(chatId);
        return next;
      });
      toast.success("已取消置顶");
    } catch {
      toast.error("取消置顶失败");
    } finally {
      setUnpinningId(null);
    }
  };

  // 🚨 修改：简化为只传递 chatIds 数组，不再拼接长文本
  const handleSummarize = async (agent: Agent) => {
    if (summarizing) return;
    setSummarizing(true);
    try {
      const selectedChatIds = Array.from(selected);

      // 1. 构造汇总任务参数
      const payload = JSON.stringify({
        chatIds: selectedChatIds,
        agentId: agent.id,
      });

      // 2. 生成新对话 ID
      const newChatId = generateUUID();

      // 3. 存入 sessionStorage，由 use-active-chat.tsx 消费
      sessionStorage.setItem(`pending-summarize-task-${newChatId}`, payload);
      // 🚨 新增：和普通聊天一样，缓存 agentId 给聊天页面组件接管
      sessionStorage.setItem(`pending-chat-${newChatId}`, agent.id);
      
      // 4. 跳转新页面，触发 useChat 自动发送
      setShowAgentPicker(false);
      router.push(`/chat/${newChatId}`);
    } catch {
      toast.error("生成报告失败，请重试");
    } finally {
      setSummarizing(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* 顶部栏 */}
      <header className="page-header shrink-0">
        <button
          className="back-button"
          onClick={() => router.back()}
          type="button"
        >
          <ArrowLeft className="size-3.5" />
          <span className="hidden sm:inline">返回</span>
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <Pin className="size-4 shrink-0 text-primary" />
          <h1 className="truncate text-sm font-semibold text-foreground">
            我的置顶
          </h1>
          {chats.length > 0 && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              {chats.length}
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {selected.size > 0 && (
            <>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                已选 {selected.size} 项
              </span>
              <span className="text-xs text-muted-foreground sm:hidden">
                {selected.size}
              </span>
              <button
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                onClick={() => setShowAgentPicker(true)}
                type="button"
              >
                <Sparkles className="size-3.5" />
                <span className="hidden sm:inline">信息汇总</span>
                <span className="sm:hidden">汇总</span>
              </button>
              <button
                className="rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted"
                onClick={clearSelection}
                type="button"
              >
                <span className="hidden sm:inline">取消选择</span>
                <span className="sm:hidden">取消</span>
              </button>
            </>
          )}
        </div>
      </header>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          {/* 搜索框 */}
          {chats.length > 5 && (
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
              <input
                className="search-input"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索置顶对话..."
                type="text"
                value={search}
              />
            </div>
          )}

          {/* 加载中 */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* 空状态 */}
          {!isLoading && chats.length === 0 && (
            <div className="empty-state">
              <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted/60">
                <Pin className="size-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground/70">
                还没有置顶的对话
              </p>
              <p className="mt-1 px-4 text-xs text-muted-foreground">
                在侧边栏聊天记录中，点击对话右侧的「···」菜单选择「置顶」
              </p>
              <button
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-border/50 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => router.push("/chat")}
                type="button"
              >
                <MessageSquare className="size-3.5" />
                去对话
              </button>
            </div>
          )}

          {/* 搜索无结果 */}
          {!isLoading && chats.length > 0 && filtered.length === 0 && (
            <div className="empty-state py-16">
              <Search className="mb-3 size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">未找到匹配的对话</p>
            </div>
          )}

          {/* 全选按钮 */}
          {filtered.length > 0 && (
            <div className="mb-3 flex items-center justify-between">
              <button
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                onClick={selected.size === filtered.length ? clearSelection : selectAll}
                type="button"
              >
                {selected.size === filtered.length && selected.size > 0 ? (
                  <>
                    <CheckCheck className="size-3.5" />
                    取消全选
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" />
                    全选
                  </>
                )}
              </button>
            </div>
          )}

          {/* 置顶对话列表 */}
          <div className="flex flex-col gap-2">
            {filtered.map((chat) => {
              const isSelected = selected.has(chat.id);
              const avatarChar = chat.agentName
                ? getAvatarChar(chat.agentName)
                : "?";
              return (
                <div
                  className={cn(
                    "group relative flex items-start gap-2.5 rounded-xl border p-3 transition-all sm:gap-3 sm:p-3.5",
                    isSelected
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/50 bg-card hover:border-border hover:bg-muted/30"
                  )}
                  key={chat.id}
                >
                  {/* 选择框 */}
                  <button
                    aria-label={isSelected ? "取消选择" : "选择"}
                    className="touch-target mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors"
                    onClick={() => toggleSelect(chat.id)}
                    type="button"
                  >
                    {isSelected && <Check className="size-3.5 text-primary" />}
                  </button>

                  {/* 头像 */}
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
                    {avatarChar}
                  </div>

                  {/* 内容 */}
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => router.push(`/chat/${chat.id}`)}
                    type="button"
                  >
                    <h3 className="truncate text-sm font-medium text-foreground">
                      {chat.title || "未命名对话"}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      {chat.agentName && (
                        <span className="inline-flex items-center gap-1">
                          <span className="size-1.5 rounded-full bg-primary/50" />
                          <span className="max-w-[120px] truncate">
                            {chat.agentName}
                          </span>
                        </span>
                      )}
                      <span>
                        {formatDistance(new Date(chat.createdAt), new Date(), {
                          addSuffix: true,
                          locale: zhCN,
                        })}
                      </span>
                    </div>
                  </button>

                  {/* 取消置顶按钮 */}
                  <button
                    aria-label="取消置顶"
                    className="touch-target shrink-0 rounded-lg p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                    disabled={unpinningId === chat.id}
                    onClick={() => handleUnpin(chat.id)}
                    title="取消置顶"
                    type="button"
                  >
                    {unpinningId === chat.id ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <PinOff className="size-4" />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 选择 OPC 生成汇总报告 */}
      <Dialog onOpenChange={setShowAgentPicker} open={showAgentPicker}>
        <DialogContent className="dialog-mobile-friendly max-w-md">
          <DialogHeader>
            <DialogTitle>选择 OPC 生成汇总报告</DialogTitle>
            <DialogDescription>
              将选中的 {selected.size} 个置顶对话信息发送给所选 OPC，生成综合分析报告。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60dvh] overflow-y-auto">
            {activeAgents.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">
                暂无可用 OPC
              </p>
            ) : (
              activeAgents.map((agent) => (
                <button
                  className="touch-target flex w-full items-center gap-3 rounded-lg border border-transparent p-2.5 text-left transition-colors hover:border-border hover:bg-muted/50 disabled:opacity-50"
                  disabled={summarizing}
                  key={agent.id}
                  onClick={() => handleSummarize(agent)}
                  type="button"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
                    {getAvatarChar(agent.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {agent.name}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {agent.description}
                    </p>
                  </div>
                  {summarizing && (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  )}
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <button
              className="touch-target rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              onClick={() => setShowAgentPicker(false)}
              type="button"
            >
              取消
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
