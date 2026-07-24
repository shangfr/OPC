"use client";

/**
 * MobileHome - 移动端首页
 *
 * 简洁布局：
 * - 顶部品牌区（Logo + 问候语 + 菜单按钮）
 * - 快捷指令卡片
 * - 推荐 OPC
 * - 底部常驻输入栏
 */

import {
  Bot,
  Lightbulb,
  Mail,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { cn, safeSessionStorageSet } from "@/lib/utils";

interface MobileHomeProps {
  modelName?: string;
  userName?: string;
}

export function MobileHome({ modelName = "GLM-4.1V", userName }: MobileHomeProps) {
  const router = useRouter();
  const { toggleSidebar } = useSidebar();
  const [input, setInput] = useState("");

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
    [router]
  );

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    createChat(trimmed);
    setInput("");
  }, [input, createChat]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 6) return "夜深了";
    if (hour < 11) return "早上好";
    if (hour < 14) return "中午好";
    if (hour < 18) return "下午好";
    return "晚上好";
  }, []);

  const suggestionPrompts = useMemo(
    () => [
      {
        icon: Mail,
        title: "写邮件",
        prompt: "请帮我写一封正式的工作邮件，主题是申请下周两天年假，语气礼貌简洁。",
        color: "text-sky-500",
        bg: "bg-sky-500/10",
      },
      {
        icon: Lightbulb,
        title: "头脑风暴",
        prompt: "请帮我头脑风暴 5 个面向年轻人的线下活动创意，要求新颖且可落地。",
        color: "text-amber-500",
        bg: "bg-amber-500/10",
      },
    ],
    []
  );

  return (
    <div className="flex h-dvh w-full flex-col overflow-x-hidden bg-background md:hidden [touch-action:pan-y] overscroll-x-none">
      {/* ===== 顶部品牌区 ===== */}
      <header className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="打开菜单"
        >
          <svg className="size-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-medium text-foreground">{modelName}</p>
        </div>
        <div className="size-9" />
      </header>

      {/* ===== 内容区 ===== */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 [touch-action:pan-y] overscroll-y-contain">
        {/* Hero */}
        <div className="flex flex-col items-center pt-6 pb-8 text-center">
          <div className="mb-4 flex size-16 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-primary/10">
            <img alt="OPC Bot" className="size-full object-cover" src="/logo.jpg" />
          </div>
          <p className="mb-1 text-sm text-muted-foreground">
            {greeting}
            {userName ? `, ${userName}` : ""}
          </p>
          <h1 className="text-xl font-semibold tracking-tight">有什么可以帮你？</h1>
        </div>

        {/* 快捷入口 */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => createChat()}
            className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-primary/30 hover:bg-accent"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-sky-500/10">
              <Sparkles className="size-5 text-sky-500" />
            </div>
            <span className="text-sm font-medium">新建对话</span>
          </button>
          <button
            type="button"
            onClick={() => router.push("/explore")}
            className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-primary/30 hover:bg-accent"
          >
            <div className="flex size-10 items-center justify-center rounded-lg bg-rose-500/10">
              <Bot className="size-5 text-rose-500" />
            </div>
            <span className="text-sm font-medium">选择 OPC</span>
          </button>
        </div>

        {/* 灵感提示词 */}
        <div className="mb-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            灵感提示词
          </h2>
          <div className="grid gap-2">
            {suggestionPrompts.map((s) => (
              <button
                key={s.title}
                type="button"
                onClick={() => createChat(s.prompt)}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-card p-3 text-left transition-all hover:border-primary/30 hover:bg-accent"
              >
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    s.bg
                  )}
                >
                  <s.icon className={cn("size-4", s.color)} />
                </div>
                
                {/* 修改点：添加 max-w-[calc(100%-theme('spacing.8'))-theme('spacing.3')] 或依赖 flex-1 自动收缩 */}
                {/* 添加 break-all 让长文本自动换行 */}
                <div className="min-w-0 flex-1"> 
                  <p className="text-sm font-medium text-foreground">{s.title}</p>
                  
                  {/* 🚨 关键修复：添加 break-all 或 break-words */}
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 break-words">
                    {s.prompt}
                  </p>
                </div>
                
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/40" />
              </button>
            ))}
          </div>
        </div> 
      </div> 
      {/* ===== 底部输入栏 ===== */}
      <div className="w-full overflow-x-hidden border-t border-border/50 bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2">
          <input
            className="flex-1 rounded-xl border border-border/50 bg-muted/30 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="随便问点什么..."
            type="text"
            value={input}
          />
          <Button
            type="button"
            size="icon"
            onClick={handleSend}
            disabled={!input.trim()}
            className="size-10 shrink-0 rounded-full"
            aria-label="发送"
          >
            <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Button>
        </div>
      </div>
    </div>
  );
}
