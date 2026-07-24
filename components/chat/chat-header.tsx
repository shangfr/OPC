"use client";

import { ArrowLeftRight, Download, MoreVertical, PenSquare, Search, Share } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { getAvatarChar } from "@/lib/agent-groups";
import type { Agent } from "@/lib/db/schema";
import {
  downloadTextFile,
  exportMessagesToMarkdown,
  sanitizeFilename,
} from "@/lib/chat-utils";
import type { ChatMessage } from "@/lib/types";
import { cn, fetcher, safeSessionStorageSet } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { updateChatVisibility } from "@/app/(chat)/actions";
import { VisibilitySelector, type VisibilityType } from "./visibility-selector";

function PureChatHeader({
  chatId,
  agentName,
  selectedVisibilityType,
  isReadonly,
}: {
  chatId: string;
  agentName: string | null;
  selectedVisibilityType: VisibilityType;
  isReadonly: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [switching, setSwitching] = useState(false);

  const { data: agents = [] } = useSWR<Agent[]>(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/agents`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

  // 仅展示活跃的 OPC
  const activeAgents = useMemo(
    () => agents.filter((a) => a.isActive),
    [agents]
  );

  const filteredAgents = useMemo(() => {
    if (!search.trim()) return activeAgents;
    const q = search.trim().toLowerCase();
    return activeAgents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q)
    );
  }, [activeAgents, search]);

  const handleSwitch = async (agent: Agent) => {
    if (switching) return;
    setSwitching(true);
    try {
      const res = await fetch("/api/chat/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.id }),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      const { chatId: newChatId } = await res.json();
      safeSessionStorageSet(`pending-chat-${newChatId}`, agent.id);
      setOpen(false);
      router.push(`/chat/${newChatId}`);
    } catch {
      toast.error("切换 OPC 失败，请重试");
    } finally {
      setSwitching(false);
    }
  };

  // 关闭弹窗时清空搜索
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  // 新建对话：创建一个空白对话并跳转
  const handleNewChat = async () => {
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
  };

  // 导出当前对话为 Markdown 文件
  // OPC 场景下用于知识沉淀：将高质量对话归档到本地或知识库
  const { mutate } = useSWRConfig();
  const [isExporting, setIsExporting] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages?chatId=${chatId}`,
      );
      if (!res.ok) throw new Error("获取消息失败");
      // 修复：API 返回的是 { messages, title, visibility, ... } 对象，而非裸数组。
      // 之前直接把整个响应对象当作 messages 数组使用，导致 .length 异常、
      // exportMessagesToMarkdown 内部 map 报错。这里正确解构 .messages 字段。
      const data: { messages?: ChatMessage[]; error?: string } = await res.json();
      if (data.error) throw new Error(data.error);
      const messages: ChatMessage[] = data.messages ?? [];
      if (messages.length === 0) {
        toast.error("当前对话没有可导出的消息");
        return;
      }
      const markdown = exportMessagesToMarkdown(messages, {
        title: agentName ? `${agentName} 对话记录` : "对话记录",
        agentName,
      });
      const filename = `${sanitizeFilename(agentName || "对话")}-${chatId.slice(0, 8)}.md`;
      downloadTextFile(markdown, filename);
      toast.success(`已导出 ${messages.length} 条消息`);
    } catch {
      toast.error("导出失败，请重试");
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (isSharing) return;
    setIsSharing(true);
    try {
      // 1. 先将对话设为公开，否则他人打开链接会 403
      await updateChatVisibility({ chatId, visibility: "public" });
      // 同步本地 SWR 缓存（key 与 useChatVisibility 一致），
      // 让 VisibilitySelector 立即显示"公开"，无需刷新页面。
      mutate(`${chatId}-visibility`, "public", false);

      // 2. 构造分享链接：对方打开后会走 /api/messages?chatId= 接口，
      //    该接口在 getMessagesByChatId 中已按 createdAt 升序返回，
      //    且 exportMessagesToMarkdown 内部还有一次稳定排序，
      //    因此时间顺序一定是正确的（早 → 晚）。
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
      const shareUrl = `${origin}${basePath}/chat/${chatId}`;

      // 3. 复制到剪贴板
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("分享链接已复制，对方打开即可按时间顺序查看对话");
      } else {
        // 降级：clipboard API 不可用时，用 textarea + execCommand
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        toast.success("分享链接已复制，对方打开即可按时间顺序查看对话");
      }
    } catch {
      toast.error("分享失败，请重试");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <header className="page-header">
      {/* 移动端侧边栏触发器：桌面端由侧边栏自身控制 */}
      <SidebarTrigger className="-ml-1 md:hidden" />

      {agentName && (
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-muted-foreground">
            {getAvatarChar(agentName)}
          </div>
          <span className="truncate text-sm font-medium text-foreground/80">
            {agentName}
          </span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
        {/* 新建对话 */}
        <button
          className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/[0.06] px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/[0.1] hover:border-primary/30"
          onClick={handleNewChat}
          title="新建对话"
          type="button"
        >
          <PenSquare className="size-3.5" />
        </button>

        {/* OPC 切换按钮 */}
        <Popover onOpenChange={setOpen} open={open}>
          <PopoverTrigger asChild>
            <button
              className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              disabled={switching}
              title="切换 OPC"
              type="button"
            >
              <ArrowLeftRight className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="end"
            className="w-[calc(100vw-2rem)] max-w-80 p-0 sm:w-80"
            sideOffset={8}
          >
            <div className="border-b p-3">
              <p className="mb-2 text-xs font-semibold text-foreground">
                切换到其他 OPC
              </p>
            </div>
            <div className="max-h-[60dvh] overflow-y-auto p-1.5">
              {filteredAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Search className="mb-2 size-6 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">
                    {search.trim() ? "未找到匹配的 OPC" : "暂无可用 OPC"}
                  </p>
                </div>
              ) : (
                filteredAgents.map((agent) => {
                  const avatarChar = getAvatarChar(agent.name);
                  const isCurrent = agent.name === agentName;
                  return (
                    <button
                      className={cn(
                        "touch-target flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-muted",
                        isCurrent && "bg-muted/50",
                        switching && "opacity-50"
                      )}
                      disabled={switching}
                      key={agent.id}
                      onClick={() => handleSwitch(agent)}
                      type="button"
                    >
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground">
                        {avatarChar}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-foreground">
                          {agent.name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {agent.description}
                        </p>
                      </div>
                      {isCurrent && (
                        <span className="shrink-0 text-[10px] font-medium text-primary">
                          当前
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* 更多操作：导出 / 分享（改为 Popover） */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              disabled={isExporting || isSharing}
              title="更多操作"
              type="button"
            >
              <MoreVertical className="size-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 p-1.5" sideOffset={8}>
            {/* 导出按钮 */}
            <button
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              disabled={isExporting}
              onClick={() => {
                handleExport();
              }}
              type="button"
            >
              <Download className="size-4" />
              <span>{isExporting ? "导出中…" : "导出"}</span>
            </button>

            {/* 分享按钮 */}
            <button
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              disabled={isSharing}
              onClick={() => {
                handleShare();
              }}
              type="button"
            >
              <Share className="size-4" />
              <span>{isSharing ? "分享中…" : "分享"}</span>
            </button>
          </PopoverContent>
        </Popover>

      </div>
    </header>
  );
}

export const ChatHeader = memo(PureChatHeader, (prevProps, nextProps) => {
  return (
    prevProps.chatId === nextProps.chatId &&
    prevProps.agentName === nextProps.agentName &&
    prevProps.selectedVisibilityType === nextProps.selectedVisibilityType &&
    prevProps.isReadonly === nextProps.isReadonly
  );
});
