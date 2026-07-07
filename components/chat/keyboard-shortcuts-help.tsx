"use client";

import { KeyboardIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

/**
 * 键盘快捷键帮助面板
 *
 * OPC 场景下，一人公司用户高度依赖键盘操作以提升效率。
 * 本组件提供：
 * 1. 一个可点击的图标按钮，打开快捷键说明弹窗
 * 2. 全局 Cmd/Ctrl + / 快捷键绑定，随时唤起帮助
 *
 * 快捷键列表基于项目现有功能整理，包含导航、对话、Agent 等高频操作。
 */

type ShortcutItem = {
  keys: string[];
  description: string;
};

type ShortcutGroup = {
  title: string;
  items: ShortcutItem[];
};

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "导航",
    items: [
      {
        keys: ["⌘", "K"],
        description: "聚焦输入框 / 开始新对话",
      },
      {
        keys: ["⌘", "B"],
        description: "展开 / 折叠侧边栏",
      },
      {
        keys: ["⌘", "/"],
        description: "打开快捷键帮助（本面板）",
      },
    ],
  },
  {
    title: "对话",
    items: [
      {
        keys: ["↵"],
        description: "发送消息",
      },
      {
        keys: ["⇧", "↵"],
        description: "换行（不发送）",
      },
      {
        keys: ["/"],
        description: "在输入框中唤起斜杠命令菜单",
      },
      {
        keys: ["⌘", "↵"],
        description: "在对话中追加消息（部分场景）",
      },
    ],
  },
  {
    title: "消息操作",
    items: [
      {
        keys: ["Hover"],
        description: "悬停消息显示操作栏（复制 / 编辑 / 重新生成）",
      },
      {
        keys: ["Click"],
        description: "点击复制图标复制消息原文",
      },
    ],
  },
  {
    title: "Agent 与管理",
    items: [
      {
        keys: ["/explore"],
        description: "在地址栏输入，进入 OPC 智库浏览",
      },
      {
        keys: ["/pinned"],
        description: "查看置顶对话与信息汇聚",
      },
      {
        keys: ["/artifacts"],
        description: "查看 AI 生成的交付物品库",
      },
    ],
  },
];

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[1.5rem] items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + / 打开快捷键帮助
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      // ESC 关闭
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <button
          aria-label="键盘快捷键"
          className="touch-target inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="键盘快捷键 (⌘/)"
          type="button"
        >
          <KeyboardIcon className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg gap-0 p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-base">键盘快捷键</DialogTitle>
          <DialogDescription className="text-xs">
            高效操作指南 · 按
            <KeyCap>⌘</KeyCap>
            <KeyCap>/</KeyCap>
            随时唤起本面板
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-5">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.title} className="flex flex-col gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </h3>
                <div className="flex flex-col gap-1.5">
                  {group.items.map((item) => (
                    <div
                      className="flex items-center justify-between gap-3 py-1"
                      key={item.description}
                    >
                      <span className="text-[13px] text-foreground/80">
                        {item.description}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        {item.keys.map((key, idx) => (
                          <KeyCap key={`${key}-${idx}`}>{key}</KeyCap>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
