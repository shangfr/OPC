import { Pin, PinOff } from "lucide-react";
import Link from "next/link";
import { memo, useCallback } from "react";
import { useChatVisibility } from "@/hooks/use-chat-visibility";
import { getChatCache, setChatCache } from "@/hooks/use-message-cache";
import type { Chat } from "@/lib/db/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "../ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import {
  CheckCircleFillIcon,
  GlobeIcon,
  LockIcon,
  MoreHorizontalIcon,
  ShareIcon,
  TrashIcon,
} from "./icons";

const PureChatItem = ({
  chat,
  isActive,
  onDelete,
  onPin,
  isSelecting,
  isSelected,
  onToggleSelect,
  setOpenMobile,
}: {
  chat: Chat;
  isActive: boolean;
  onDelete: (chatId: string) => void;
  onPin: (chatId: string, pinned: boolean) => void;
  isSelecting: boolean;
  isSelected: boolean;
  onToggleSelect: (chatId: string) => void;
  setOpenMobile: (open: boolean) => void;
}) => {
  const { visibilityType, setVisibilityType } = useChatVisibility({
    chatId: chat.id,
    initialVisibilityType: chat.visibility,
  });

  // P1: Prefetch messages on hover for instant navigation
  const handlePrefetch = useCallback(() => {
    if (getChatCache(chat.id)) {
      return; // Already cached
    }
    fetch(`/api/messages?chatId=${chat.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setChatCache(chat.id, {
            messages: data.messages ?? [],
            agentId: data.agentId ?? null,
            visibility: data.visibility ?? "private",
            title: data.title,
            agentName: data.agentName,
          });
        }
      })
      .catch((err) => console.error("Prefetch failed:", err));
  }, [chat.id]);

  const isPinned = !!chat.pinnedAt;

  return (
    <SidebarMenuItem className="group/item relative">
      {isSelecting && (
        <button
          aria-label={
            isSelected ? `取消选择会话 ${chat.title}` : `选择会话 ${chat.title}`
          }
          aria-pressed={isSelected}
          className="absolute left-0 top-1/2 z-10 flex h-9 w-7 -translate-y-1/2 items-center justify-center text-sidebar-foreground/50 transition-colors hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(chat.id);
          }}
          type="button"
        >
          {isSelected ? (
            <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
              <rect
                fill="currentColor"
                height="14"
                rx="3"
                width="14"
                x="1"
                y="1"
              />
              <path
                d="M4.5 8L7 10.5L11.5 5.5"
                stroke="white"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
          ) : (
            <svg fill="none" height="16" viewBox="0 0 16 16" width="16">
              <rect
                height="13"
                rx="2.5"
                stroke="currentColor"
                strokeWidth="1"
                width="13"
                x="1.5"
                y="1.5"
              />
            </svg>
          )}
        </button>
      )}
      {chat.agentName ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <SidebarMenuButton
              asChild
              className={`h-8 rounded-none text-[13px] text-sidebar-foreground/50 transition-all duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground data-active:bg-transparent data-active:font-normal data-active:text-sidebar-foreground/50 data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium data-[active=true]:border-l-2 data-[active=true]:border-sidebar-primary data-[active=true]:bg-sidebar-primary/[0.08] data-[active=true]:pl-3 ${isSelecting ? "pl-7" : ""}`}
              isActive={isActive}
            >
              <Link
                href={`/chat/${chat.id}`}
                onClick={() => setOpenMobile(false)}
                onMouseEnter={handlePrefetch}
              >
                <span className="truncate flex items-center gap-1">
                  {isPinned && !isSelecting && (
                    <Pin className="shrink-0 text-sidebar-primary" size={12} />
                  )}
                  {chat.title}
                </span>
              </Link>
            </SidebarMenuButton>
          </TooltipTrigger>
          <TooltipContent side="right">{chat.agentName}</TooltipContent>
        </Tooltip>
      ) : (
        <SidebarMenuButton
          asChild
          className={`h-8 rounded-none text-[13px] text-sidebar-foreground/50 transition-all duration-150 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground data-active:bg-transparent data-active:font-normal data-active:text-sidebar-foreground/50 data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium data-[active=true]:border-l-2 data-[active=true]:border-sidebar-primary data-[active=true]:bg-sidebar-primary/[0.08] data-[active=true]:pl-3 ${isSelecting ? "pl-7" : ""}`}
          isActive={isActive}
        >
          <Link
            href={`/chat/${chat.id}`}
            onClick={() => setOpenMobile(false)}
            onMouseEnter={handlePrefetch}
          >
            <span className="truncate flex items-center gap-1">
              {isPinned && !isSelecting && (
                <Pin className="shrink-0 text-sidebar-primary" size={12} />
              )}
              {chat.title}
            </span>
          </Link>
        </SidebarMenuButton>
      )}

      <DropdownMenu modal={true}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            aria-label={`会话 ${chat.title} 的更多操作`}
            className="mr-0.5 rounded-md text-sidebar-foreground/50 ring-0 transition-colors duration-150 focus-visible:ring-0 hover:text-sidebar-foreground data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            showOnHover={!isActive}
          >
            <MoreHorizontalIcon />
            <span className="sr-only">更多</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" side="bottom">
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <ShareIcon />
              <span>分享</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem
                  className="cursor-pointer flex-row justify-between"
                  onClick={() => {
                    setVisibilityType("private");
                  }}
                >
                  <div className="flex flex-row items-center gap-2">
                    <LockIcon size={12} />
                    <span>私密</span>
                  </div>
                  {visibilityType === "private" ? (
                    <CheckCircleFillIcon />
                  ) : null}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="cursor-pointer flex-row justify-between"
                  onClick={() => {
                    setVisibilityType("public");
                  }}
                >
                  <div className="flex flex-row items-center gap-2">
                    <GlobeIcon />
                    <span>公开</span>
                  </div>
                  {visibilityType === "public" ? <CheckCircleFillIcon /> : null}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => onPin(chat.id, !isPinned)}
          >
            {isPinned ? (
              <>
                <PinOff size={14} />
                <span>取消置顶</span>
              </>
            ) : (
              <>
                <Pin size={14} />
                <span>置顶</span>
              </>
            )}
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={() => onDelete(chat.id)}
            variant="destructive"
          >
            <TrashIcon />
            <span>删除</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
};

export const ChatItem = memo(PureChatItem, (prevProps, nextProps) => {
  if (prevProps.isActive !== nextProps.isActive) {
    return false;
  }
  if (prevProps.isSelecting !== nextProps.isSelecting) {
    return false;
  }
  if (prevProps.isSelected !== nextProps.isSelected) {
    return false;
  }
  if (prevProps.chat.pinnedAt !== nextProps.chat.pinnedAt) {
    return false;
  }
  return true;
});
