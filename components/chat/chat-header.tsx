"use client";

import { ArrowLeftRight, Download, Search } from "lucide-react";
import { memo, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import useSWR from "swr";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { KeyboardShortcutsHelp } from "./keyboard-shortcuts-help";
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

  // 导出当前对话为 Markdown 文件
  // OPC 场景下用于知识沉淀：将高质量对话归档到本地或知识库
  const [isExporting, setIsExporting] = useState(false);
  const handleExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/messages?chatId=${chatId}`,
      );
      if (!res.ok) throw new Error("获取消息失败");
      const messages: ChatMessage[] = await res.json();
      if (!messages || messages.length === 0) {
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
        {/* 导出对话为 Markdown：OPC 场景下用于知识沉淀与归档 */}
        <button
          className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          disabled={isExporting}
          onClick={handleExport}
          title="导出为 Markdown"
          type="button"
        >
          <Download className="size-3.5" />
          <span className="hidden sm:inline">
            {isExporting ? "导出中..." : "导出"}
          </span>
        </button>

        {/* 键盘快捷键帮助 */}
        <KeyboardShortcutsHelp />

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
              <span className="hidden sm:inline">切换 OPC</span>
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

        {!isReadonly && (
          <VisibilitySelector
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
          />
        )}
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
