"use client";

/**
 * MobileHome - 移动端首页
 *
 * 参考智谱清言小程序首页布局：
 * - 顶部品牌区（模型标识 + 引导文案 + 菜单按钮）
 * - 可滑动 Tab 区（聊天 / OPC / 灵感 / 历史）
 * - 底部常驻输入栏
 *
 * 核心交互：
 * - Tab 点击切换 + 指示器滑动动画
 * - 内容区左右手势滑动切换 Tab
 * - Tab 与内容双向联动
 */

import {
  Bot,
  ChevronDown,
  FileText,
  Image as ImageIcon,
  Lightbulb,
  MessageSquare,
  Mic,
  Paperclip,
  Presentation,
  Pin,
  Code2,
  Video,
  Clock,
  Sparkles,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { SwipeableTabs, type SwipeableTab } from "./swipeable-tabs";
import { safeSessionStorageSet } from "@/lib/utils";

interface MobileHomeProps {
  /** 默认模型名称 */
  modelName?: string;
  /** 用户名（用于引导文案） */
  userName?: string;
}

export function MobileHome({
  modelName = "GLM-4.1V",
  userName,
}: MobileHomeProps) {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();
  const [input, setInput] = useState("");

  // 创建新对话
  const createChat = useCallback(
    async (prompt?: string) => {
      try {
        const res = await fetch("/api/chat/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error("Failed to create chat");
        const { chatId } = await res.json();
        if (prompt) {
          safeSessionStorageSet(`pending-prompt-${chatId}`, prompt);
          router.push(`/chat/${chatId}?prompt=${encodeURIComponent(prompt)}`);
        } else {
          router.push(`/chat/${chatId}`);
        }
      } catch {
        toast.error("创建对话失败，请重试");
      }
    },
    [router],
  );

  // 发送消息
  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    createChat(trimmed);
    setInput("");
  }, [input, createChat]);

  // 快捷功能入口（横向滚动）
  const quickActions = useMemo(
    () => [
      {
        icon: MessageSquare,
        label: "和我聊聊天吧",
        color: "text-sky-500 bg-sky-500/10",
        action: () => createChat(),
      },
      {
        icon: Bot,
        label: "Agent",
        color: "text-rose-500 bg-rose-500/10",
        action: () => router.push("/explore"),
      },
      {
        icon: FileText,
        label: "研究报告",
        color: "text-amber-500 bg-amber-500/10",
        action: () => createChat("请帮我生成一份研究报告，主题是："),
      },
      {
        icon: Presentation,
        label: "PPT制作",
        color: "text-violet-500 bg-violet-500/10",
        action: () => createChat("请帮我制作一份PPT大纲，主题是："),
      },
    ],
    [createChat, router],
  );

  // 更多功能（低频，下拉展开）
  const moreActions = useMemo(
    () => [
      { icon: ImageIcon, label: "AI绘图", color: "text-pink-500", prompt: "请帮我画一张图片：" },
      { icon: Code2, label: "代码助手", color: "text-emerald-500", prompt: "请帮我解释这段代码：" },
      { icon: Video, label: "视频生成", color: "text-orange-500", prompt: "请帮我生成一段视频脚本：" },
      { icon: FileText, label: "文档处理", color: "text-blue-500", prompt: "请帮我处理文档：" },
    ],
    [],
  );

  // 灵感提示词
  const suggestionPrompts = useMemo(
    () => [
      { icon: "✍️", title: "帮我写一封邮件", prompt: "请帮我写一封正式的工作邮件，主题是申请下周两天年假，语气礼貌简洁。" },
      { icon: "💡", title: "头脑风暴点子", prompt: "请帮我头脑风暴 5 个面向年轻人的线下活动创意，要求新颖且可落地。" },
      { icon: "📊", title: "总结一篇文章", prompt: "请把下面这段文字总结成 3 个要点：\n\n（在此粘贴需要总结的内容）" },
      { icon: "💻", title: "解释一段代码", prompt: "请用通俗易懂的语言解释下面这段代码的作用：\n\n（在此粘贴代码）" },
    ],
    [],
  );

  // SwipeableTabs 配置
  const tabs: SwipeableTab[] = useMemo(
    () => [
      {
        label: "聊天",
        value: "chat",
        icon: MessageSquare,
        content: (
          <div className="flex h-full flex-col px-4 py-3">
            {/* 快捷功能入口 */}
            <div className="mb-4">
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.action}
                    className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl border border-border/40 bg-card px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-accent"
                  >
                    <div className={`flex size-9 items-center justify-center rounded-lg ${action.color}`}>
                      <action.icon className="size-4" />
                    </div>
                    <span className="text-[11px] font-medium text-foreground">
                      {action.label}
                    </span>
                  </button>
                ))}

                {/* 更多功能下拉 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex shrink-0 flex-col items-center gap-1.5 rounded-xl border border-border/40 bg-card px-3 py-2.5 transition-colors hover:border-primary/30 hover:bg-accent"
                    >
                      <div className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <ChevronDown className="size-4" />
                      </div>
                      <span className="text-[11px] font-medium text-foreground">
                        更多
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" sideOffset={4}>
                    {moreActions.map((action) => (
                      <DropdownMenuItem
                        key={action.label}
                        onClick={() => action.prompt && createChat(action.prompt)}
                        className="cursor-pointer"
                      >
                        <action.icon className={`size-4 ${action.color}`} />
                        <span>{action.label}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* 对话空白区 */}
            <div className="flex flex-1 flex-col items-center justify-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/5 ring-1 ring-primary/10">
                <Bot className="size-8 text-primary/40" />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                {userName ? `${userName}，` : ""}随时开始你的对话
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                在下方输入框提问，或选择上方的快捷功能
              </p>
            </div>
          </div>
        ),
      },
      {
        label: "灵感",
        value: "inspiration",
        icon: Lightbulb,
        content: (
          <div className="h-full overflow-y-auto px-4 py-3">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              快捷指令
            </h2>
            <div className="grid gap-2">
              {suggestionPrompts.map((s) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => createChat(s.prompt)}
                  className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3 text-left transition-all hover:border-primary/30 hover:bg-accent"
                >
                  <span className="text-xl">{s.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{s.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {s.prompt.slice(0, 30)}...
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ),
      },
      {
        label: "OPC",
        value: "opc",
        icon: Bot,
        content: (
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-rose-500/5 ring-1 ring-rose-500/10">
              <Bot className="size-8 text-rose-500/40" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              探索 OPC 智能体
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              选择一位专业 AI 顾问开始对话
            </p>
            <Button
              variant="soft"
              size="sm"
              className="mt-4"
              onClick={() => router.push("/explore")}
            >
              浏览全部 OPC →
            </Button>
          </div>
        ),
      },
      {
        label: "收藏",
        value: "pinned",
        icon: Pin,
        content: (
          <div className="flex h-full flex-col items-center justify-center px-4">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-amber-500/5 ring-1 ring-amber-500/10">
              <Pin className="size-8 text-amber-500/40" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">
              收藏的对话
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              查看你置顶的重要对话
            </p>
            <Button
              variant="soft"
              size="sm"
              className="mt-4"
              onClick={() => router.push("/pinned")}
            >
              查看收藏 →
            </Button>
          </div>
        ),
      },
    ],
    [quickActions, moreActions, suggestionPrompts, createChat, router, userName],
  );

  return (
    <div className="flex h-dvh flex-col bg-background md:hidden">
      {/* ===== 顶部品牌区 ===== */}
      <header className="flex items-center gap-3 px-4 pt-4 pb-2">
        {/* 左上角菜单按钮（呼出历史会话抽屉） */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="打开菜单"
        >
          <svg
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              d="M4 6h16M4 12h16M4 18h16"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* 模型标识 + 引导文案 */}
        <div className="flex-1 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span className="text-xs font-medium text-primary">{modelName}</span>
          </div>
          <p className="mt-0.5 text-sm font-medium text-foreground">
            今天，有什么新想法？🤔
          </p>
        </div>

        {/* 右侧历史按钮 */}
        <button
          type="button"
          onClick={() => router.push("/pinned")}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="收藏"
        >
          <Clock className="size-5" />
        </button>
      </header>

      {/* ===== 可滑动 Tab 区 ===== */}
      <SwipeableTabs
        tabs={tabs}
        defaultValue="chat"
        className="flex-1"
        tabClassName="border-b border-border/40"
        contentClassName="bg-background"
      />

      {/* ===== 底部常驻输入栏 ===== */}
      <div className="sticky bottom-0 z-10 border-t border-border/40 bg-background/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-lg">
        <div className="flex items-end gap-2">
          {/* 附件按钮 */}
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="附件"
          >
            <Paperclip className="size-4" />
          </button>

          {/* 输入框 */}
          <div className="flex flex-1 items-end rounded-2xl border border-border/60 bg-muted/50 px-3 py-2 focus-within:border-primary/40">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="输入提问、创作需求..."
              rows={1}
              className="max-h-24 flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
          </div>

          {/* 语音按钮 */}
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="语音输入"
          >
            <Mic className="size-4" />
          </button>

          {/* 发送按钮 */}
          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            disabled={!input.trim()}
            className="size-9 shrink-0 rounded-full"
            aria-label="发送"
          >
            <svg
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              <path
                d="M12 19V5M5 12l7-7 7 7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
