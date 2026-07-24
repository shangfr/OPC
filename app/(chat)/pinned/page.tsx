"use client";

import { formatDistance } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  Check,
  CheckCheck,
  Eye,
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
import { cn, fetcher, generateUUID } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";

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

  const handleUnpin = async (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
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

  const handleSummarize = async (agent: Agent) => {
    if (summarizing) return;
    setSummarizing(true);
    try {
      const selectedChatIds = Array.from(selected);
      const payload = JSON.stringify({
        chatIds: selectedChatIds,
        agentId: agent.id,
      });

      const newChatId = generateUUID();
      sessionStorage.setItem(`pending-summarize-task-${newChatId}`, payload);
      sessionStorage.setItem(`pending-chat-${newChatId}`, agent.id);

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
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6">
          
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-foreground">置顶对话</h1>
              {chats.length > 0 && (
                <p className="text-xs text-muted-foreground">共 {chats.length} 个对话</p>
              )}
            </div>

            {selected.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                  已选 {selected.size} 项
                </span>
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-transform active:scale-95"
                  onClick={() => setShowAgentPicker(true)}
                  type="button"
                >
                  <Sparkles className="size-3.5" />
                  <span className="hidden sm:inline">生成汇总</span>
                  <span className="sm:hidden">汇总</span>
                </button>
                <button
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                  onClick={clearSelection}
                  type="button"
                >
                  取消
                </button>
              </div>
            )}
          </div>

          {/* Search */}
          {chats.length > 0 && (
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

          {/* Loading & Empty States */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
          
          {!isLoading && chats.length === 0 && (
            <div className="empty-state py-20">
              <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted/60 mx-auto">
                <Pin className="size-7 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-medium text-foreground/70 text-center">还没有置顶的对话</p>
              <p className="mt-1 px-4 text-xs text-muted-foreground text-center">
                在侧边栏聊天记录中，点击对话右侧的「···」菜单选择「置顶」
              </p>
              <div className="mt-6 flex justify-center">
                <button
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
                  onClick={() => router.push("/chat")}
                  type="button"
                >
                  <MessageSquare className="size-4" /> 开始对话
                </button>
              </div>
            </div>
          )}

          {!isLoading && chats.length > 0 && filtered.length === 0 && (
            <div className="empty-state py-16 text-center">
              <Search className="mb-3 size-8 mx-auto text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">未找到匹配的对话</p>
            </div>
          )}

          {/* List */}
          {filtered.length > 0 && (
            <>
              {/* Select All */}
              <div className="mb-2 flex items-center justify-between px-1">
                <button
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  onClick={selected.size === filtered.length ? clearSelection : selectAll}
                  type="button"
                >
                  {selected.size === filtered.length && selected.size > 0 ? (
                    <>
                      <CheckCheck className="size-3.5" /> 取消全选
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" /> 全选
                    </>
                  )}
                </button>
              </div>

              {/* List Items */}
              <div className="flex flex-col rounded-xl border border-border/40 bg-card overflow-hidden">
                {filtered.map((chat, index) => {
                  const isSelected = selected.has(chat.id);
                  const avatarChar = chat.agentName ? getAvatarChar(chat.agentName) : "?";

                  return (
                    <div
                      key={chat.id}
                      className={cn(
                        "group relative flex items-center gap-3 px-3 py-2.5 transition-colors",
                        "cursor-pointer",
                        "hover:bg-muted/50",
                        isSelected && "bg-primary/5",
                        index !== filtered.length - 1 && "border-b border-border/40"
                      )}
                      onClick={() => toggleSelect(chat.id)}
                    >
                      {/* Checkbox */}
                      <Checkbox
                        className={cn(
                          "shrink-0 transition-all duration-200",
                          isSelected 
                            ? "border-primary bg-primary text-primary-foreground" 
                            : "border-border"
                        )}
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(chat.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label={isSelected ? "取消选择" : "选择"}
                      />

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className={cn(
                            "truncate text-sm transition-all duration-200",
                            isSelected ? "font-semibold text-primary" : "text-foreground/90"
                          )}>
                            {chat.title || "未命名对话"}
                          </h3>
                          {chat.agentName && (
                            <span className="hidden items-center rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-flex">
                              {chat.agentName}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatDistance(new Date(chat.createdAt), new Date(), {
                            addSuffix: true,
                            locale: zhCN,
                          })}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 text-muted-foreground">
                        {/* 查看按钮：Hover 变绿色 */}
                        <button
                          aria-label="查看对话"
                          className="rounded-md p-1.5 transition-colors hover:bg-green-500/10 hover:text-green-600 dark:hover:text-green-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/chat/${chat.id}`);
                          }}
                          type="button"
                        >
                          <Eye className="size-4" />
                        </button>

                        {/* 取消置顶按钮：Hover 变红色 */}
                        <button
                          aria-label="取消置顶"
                          className={cn(
                            "rounded-md p-1.5 transition-all duration-150",
                            "hover:bg-destructive/10 hover:text-destructive",
                            "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
                            "focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring"
                          )}
                          disabled={unpinningId === chat.id}
                          onClick={(e) => handleUnpin(chat.id, e)}
                          type="button"
                        >
                          {unpinningId === chat.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <PinOff className="size-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Dialog */}
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
              <p className="py-8 text-center text-xs text-muted-foreground">暂无可用 OPC</p>
            ) : (
              activeAgents.map((agent) => (
                <button
                  className="touch-target flex w-full items-center gap-3 rounded-lg border border-transparent p-2.5 text-left transition-colors hover:bg-muted disabled:opacity-50"
                  disabled={summarizing}
                  key={agent.id}
                  onClick={() => handleSummarize(agent)}
                  type="button"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sm font-bold text-muted-foreground">
                    {getAvatarChar(agent.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{agent.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{agent.description}</p>
                  </div>
                  {summarizing && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
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
