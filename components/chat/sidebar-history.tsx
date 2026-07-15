"use client";

import { isToday, isYesterday, subMonths, subWeeks } from "date-fns";
import { motion } from "motion/react";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWRInfinite from "swr/infinite";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  useSidebar,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import type { Chat } from "@/lib/db/schema";
import { fetcher } from "@/lib/utils";
import { ChatItem } from "./sidebar-history-item";

type GroupedChats = {
  today: Chat[];
  yesterday: Chat[];
  lastWeek: Chat[];
  lastMonth: Chat[];
  older: Chat[];
};

export type ChatHistory = {
  chats: Chat[];
  hasMore: boolean;
};

const PAGE_SIZE = 20;

const groupChatsByDate = (chats: Chat[]): GroupedChats => {
  const now = new Date();
  const oneWeekAgo = subWeeks(now, 1);
  const oneMonthAgo = subMonths(now, 1);

  return chats.reduce(
    (groups, chat) => {
      const chatDate = new Date(chat.createdAt);

      if (isToday(chatDate)) {
        groups.today.push(chat);
      } else if (isYesterday(chatDate)) {
        groups.yesterday.push(chat);
      } else if (chatDate > oneWeekAgo) {
        groups.lastWeek.push(chat);
      } else if (chatDate > oneMonthAgo) {
        groups.lastMonth.push(chat);
      } else {
        groups.older.push(chat);
      }

      return groups;
    },
    {
      today: [],
      yesterday: [],
      lastWeek: [],
      lastMonth: [],
      older: [],
    } as GroupedChats
  );
};

export function getChatHistoryPaginationKey(
  pageIndex: number,
  previousPageData: ChatHistory
) {
  if (previousPageData && previousPageData.hasMore === false) {
    return null;
  }

  if (pageIndex === 0) {
    return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history?limit=${PAGE_SIZE}`;
  }

  const firstChatFromPage = previousPageData.chats.at(-1);

  if (!firstChatFromPage) {
    return null;
  }

  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history?ending_before=${firstChatFromPage.id}&limit=${PAGE_SIZE}`;
}

export function SidebarHistory({ user }: { user: User | undefined }) {
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();
  const id = pathname?.startsWith("/chat/") ? pathname.split("/")[2] : null;

  const {
    data: paginatedChatHistories,
    setSize,
    isValidating,
    isLoading,
    mutate,
  } = useSWRInfinite<ChatHistory>(
    user ? getChatHistoryPaginationKey : () => null,
    fetcher,
    { fallbackData: [], revalidateOnFocus: false, keepPreviousData: true }
  );

  const router = useRouter();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchDeleteDialog, setShowBatchDeleteDialog] = useState(false);
  // 搜索关键词：用于在侧边栏历史列表中实时过滤对话标题
  const [searchQuery, setSearchQuery] = useState("");

  const allChats: Chat[] = paginatedChatHistories
    ? paginatedChatHistories.flatMap((page) => page.chats)
    : [];

  // 当用户输入搜索关键词时，对已加载的历史对话按标题进行模糊匹配。
  // 仅在前端过滤已加载数据，避免额外请求；当关键词为空时返回全部。
  const filteredChats = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return allChats;
    return allChats.filter((chat) =>
      chat.title?.toLowerCase().includes(query),
    );
  }, [allChats, searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  const handleToggleSelect = useCallback((chatId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) {
        next.delete(chatId);
      } else {
        next.add(chatId);
      }
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    if (selectedIds.size === allChats.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allChats.map((c) => c.id)));
    }
  }, [allChats, selectedIds.size]);

  const handleExitSelecting = useCallback(() => {
    setIsSelecting(false);
    setSelectedIds(new Set());
  }, []);

  const handlePin = useCallback(
    async (chatId: string, pinned: boolean) => {
      // Optimistic update
      mutate((chatHistories) => {
        if (!chatHistories) {
          return;
        }
        return chatHistories.map((chatHistory) => ({
          ...chatHistory,
          chats: chatHistory.chats.map((c) =>
            c.id === chatId ? { ...c, pinnedAt: pinned ? new Date() : null } : c
          ),
        }));
      }, false);

      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat?id=${chatId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pinned }),
          }
        );
        toast.success(pinned ? "已置顶" : "已取消置顶");
        // Revalidate to get correct sort order
        mutate();
      } catch {
        // Rollback
        mutate();
        toast.error("操作失败");
      }
    },
    [mutate]
  );

  const handleBatchDelete = () => {
    const idsToDelete = Array.from(selectedIds);
    const isCurrentChatDeleted = idsToDelete.includes(id ?? "");

    setShowBatchDeleteDialog(false);
    setIsSelecting(false);
    setSelectedIds(new Set());

    if (isCurrentChatDeleted) {
      router.replace("/chat");
    }

    mutate((chatHistories) => {
      if (!chatHistories) {
        return;
      }
      return chatHistories.map((chatHistory) => ({
        ...chatHistory,
        chats: chatHistory.chats.filter((c) => !idsToDelete.includes(c.id)),
      }));
    });

    fetch(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history?ids=${idsToDelete.join(",")}`,
      { method: "DELETE" }
    );

    toast.success(`已删除 ${idsToDelete.length} 个对话`);
  };

  const hasReachedEnd = paginatedChatHistories
    ? paginatedChatHistories.some((page) => page.hasMore === false)
    : false;

  const hasEmptyChatHistory = paginatedChatHistories
    ? paginatedChatHistories.every((page) => page.chats.length === 0)
    : false;

  const handleDelete = () => {
    const chatToDelete = deleteId;
    const isCurrentChat = pathname === `/chat/${chatToDelete}`;

    setShowDeleteDialog(false);

    if (isCurrentChat) {
      router.replace("/chat");
    }

    mutate((chatHistories) => {
      if (chatHistories) {
        return chatHistories.map((chatHistory) => ({
          ...chatHistory,
          chats: chatHistory.chats.filter((chat) => chat.id !== chatToDelete),
        }));
      }
    });

    fetch(
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat?id=${chatToDelete}`,
      { method: "DELETE" }
    );

    toast.success("对话已删除");
  };

  if (!user) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupContent>
          <div className="flex w-full flex-row items-center justify-center gap-2 px-2 text-[13px] text-sidebar-foreground/60">
            登录以保存和回顾之前的对话！
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (isLoading) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
          历史记录
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="flex flex-col gap-0.5 px-1">
            {[44, 32, 28, 64, 52].map((item) => (
              <div
                className="flex h-8 items-center gap-2 rounded-lg px-2"
                key={item}
              >
                <div
                  className="h-3 max-w-(--skeleton-width) flex-1 animate-pulse rounded-md bg-sidebar-foreground/[0.06]"
                  style={
                    {
                      "--skeleton-width": `${item}%`,
                    } as React.CSSProperties
                  }
                />
              </div>
            ))}
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  if (hasEmptyChatHistory) {
    return (
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
          历史记录
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <div className="flex flex-col items-center gap-3 px-3 py-6 text-center">
            <div
              aria-hidden="true"
              className="flex size-10 items-center justify-center rounded-full bg-muted/60 text-muted-foreground/50"
            >
              <svg
                fill="none"
                height="20"
                viewBox="0 0 24 24"
                width="20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M8 10h8M8 14h5"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.5"
                />
                <path
                  clipRule="evenodd"
                  d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-[13px] font-medium text-sidebar-foreground/70">
                还没有对话记录
              </p>
              <p className="text-[11px] leading-relaxed text-sidebar-foreground/50">
                发送第一条消息后，对话会自动保存在这里
              </p>
            </div>
          </div>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <>
      <SidebarGroup className="group-data-[collapsible=icon]:hidden">
        <div className="flex items-center justify-between px-2">
          <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
            历史记录
          </SidebarGroupLabel>
          {allChats.length > 0 && !isSelecting && (
            <Button
              variant="ghost"
              size="xs"
              className="h-5 px-2 text-[10px]"
              onClick={() => setIsSelecting(true)}
            >
              批量管理
            </Button>
          )}
          {isSelecting && (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="xs"
                className="h-5 px-2 text-[10px]"
                onClick={handleSelectAll}
              >
                {selectedIds.size === allChats.length ? "取消全选" : "全选"}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                className="h-5 px-2 text-[10px]"
                onClick={handleExitSelecting}
              >
                完成
              </Button>
            </div>
          )}
        </div>
        <SidebarGroupContent>
          {/* 搜索框：仅在非批量选择模式下显示，帮助用户快速定位历史对话 */}
          {allChats.length > 0 && !isSelecting && (
            <div className="px-2 pb-2">
              <input
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索对话..."
                type="text"
                value={searchQuery}
                className="w-full rounded-md border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-1.5 text-[12px] text-sidebar-foreground placeholder:text-sidebar-foreground/40 focus:outline-none focus:ring-1 focus:ring-sidebar-ring"
              />
            </div>
          )}
          <SidebarMenu>
            {paginatedChatHistories &&
              (() => {
                // 搜索模式下使用过滤后的列表，否则展示全部并按日期分组
                const chatsToRender = isSearching ? filteredChats : allChats;
                const groupedChats = groupChatsByDate(chatsToRender);

                // 搜索无结果时的空状态
                if (isSearching && chatsToRender.length === 0) {
                  return (
                    <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                      <p className="text-[12px] text-sidebar-foreground/60">
                        未找到匹配的对话
                      </p>
                      <p className="text-[11px] text-sidebar-foreground/40">
                        尝试更换关键词，或加载更多历史记录
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="flex flex-col gap-4">
                    {groupedChats.today.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                          今天
                        </div>
                        {groupedChats.today.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            isSelected={selectedIds.has(chat.id)}
                            isSelecting={isSelecting}
                            key={chat.id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onPin={handlePin}
                            onToggleSelect={handleToggleSelect}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.yesterday.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                          昨天
                        </div>
                        {groupedChats.yesterday.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            isSelected={selectedIds.has(chat.id)}
                            isSelecting={isSelecting}
                            key={chat.id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onPin={handlePin}
                            onToggleSelect={handleToggleSelect}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.lastWeek.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                          最近 7 天
                        </div>
                        {groupedChats.lastWeek.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            isSelected={selectedIds.has(chat.id)}
                            isSelecting={isSelecting}
                            key={chat.id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onPin={handlePin}
                            onToggleSelect={handleToggleSelect}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.lastMonth.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                          最近 30 天
                        </div>
                        {groupedChats.lastMonth.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            isSelected={selectedIds.has(chat.id)}
                            isSelecting={isSelecting}
                            key={chat.id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onPin={handlePin}
                            onToggleSelect={handleToggleSelect}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}

                    {groupedChats.older.length > 0 && (
                      <div>
                        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/70">
                          更早
                        </div>
                        {groupedChats.older.map((chat) => (
                          <ChatItem
                            chat={chat}
                            isActive={chat.id === id}
                            isSelected={selectedIds.has(chat.id)}
                            isSelecting={isSelecting}
                            key={chat.id}
                            onDelete={(chatId) => {
                              setDeleteId(chatId);
                              setShowDeleteDialog(true);
                            }}
                            onPin={handlePin}
                            onToggleSelect={handleToggleSelect}
                            setOpenMobile={setOpenMobile}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
          </SidebarMenu>

          <motion.div
            onViewportEnter={() => {
              if (!isValidating && !hasReachedEnd) {
                setSize((size) => size + 1);
              }
            }}
          />

          {hasReachedEnd ? null : (
            <output
              aria-label="正在加载更多对话"
              className="mt-1 flex flex-row items-center gap-2 px-4 py-2 text-sidebar-foreground/50"
            >
              <Spinner className="size-3.5" />
              <div className="text-[11px]">加载中...</div>
            </output>
          )}

          {isSelecting && selectedIds.size > 0 && (
            <div className="sticky bottom-0 bg-sidebar px-2 py-2 border-t border-sidebar-border">
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setShowBatchDeleteDialog(true)}
              >
                删除选中 ({selectedIds.size})
              </Button>
            </div>
          )}
        </SidebarGroupContent>
      </SidebarGroup>

      <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除吗？</AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。这将永久删除你的对话并从服务器中移除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={setShowBatchDeleteDialog}
        open={showBatchDeleteDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              确定要删除 {selectedIds.size} 个对话吗？
            </AlertDialogTitle>
            <AlertDialogDescription>
              此操作无法撤销。这将永久删除选中的对话并从服务器中移除。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleBatchDelete}>
              确认删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
