"use client";

/**
 * NotificationToggle — 浏览器通知开关
 *
 * 集成到 multimodal-input 工具栏，允许用户开启桌面通知。
 * 开启后，当 Agent 回复完成时（流式结束）发送桌面通知。
 *
 * 使用 shadcn/ui Button + Tooltip 组件。
 */

import { BellIcon, BellOffIcon, BellRingIcon } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { useLocalStorage } from "usehooks-ts";
import { useBrowserNotification } from "@/hooks/use-browser-notification";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export interface NotificationToggleProps {
  /** 是否有正在进行的对话（用于显示"测试通知"） */
  hasActiveChat?: boolean;
}

function PureNotificationToggle({
  hasActiveChat: _hasActiveChat = false,
}: NotificationToggleProps) {
  const { supported, permission, requestPermission, notify } =
    useBrowserNotification();

  // 本地存储用户偏好（即使授权后也可单独关闭）
  const [enabled, setEnabled] = useLocalStorage<boolean>(
    "opc-notification-enabled",
    false
  );

  // 权限变化时同步：被拒绝时强制关闭
  useEffect(() => {
    if (permission === "denied" && enabled) {
      setEnabled(false);
      toast.error("浏览器通知权限已被拒绝，请在设置中重新允许");
    }
  }, [permission, enabled, setEnabled]);

  // 浏览器不支持
  if (!supported) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex" tabIndex={-1}>
            <Button
              aria-label="浏览器通知（不支持）"
              className="h-8 w-8 rounded-lg border border-border/40 p-1 text-muted-foreground/30 cursor-not-allowed"
              disabled
              type="button"
              variant="ghost"
            >
              <BellOffIcon className="size-3.5 text-muted-foreground/30" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>当前浏览器不支持桌面通知</TooltipContent>
      </Tooltip>
    );
  }

  const handleToggle = async () => {
    if (enabled) {
      setEnabled(false);
      toast.success("已关闭桌面通知");
    } else {
      // 开启：先请求权限
      if (permission !== "granted") {
        const granted = await requestPermission();
        if (!granted) {
          toast.error("通知权限被拒绝，请在浏览器地址栏点击锁图标开启");
          return;
        }
      }
      setEnabled(true);
      toast.success("已开启桌面通知，Agent 回复完成时将提醒你");
      // 发送一条欢迎通知
      setTimeout(() => {
        notify("OPC 通知已开启", {
          body: "Agent 回复完成时将在此处提醒你",
          tag: "opc-notification-on",
          silent: true,
        });
      }, 500);
    }
  };

  const isEnabled = enabled && permission === "granted";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={isEnabled ? "关闭桌面通知" : "开启桌面通知"}
          className={cn(
            "h-8 w-8 rounded-lg border border-border/40 p-1 transition-colors",
            isEnabled
              ? "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
              : "text-foreground hover:border-border hover:bg-accent hover:text-foreground"
          )}
          data-testid="notification-toggle"
          type="button"
          variant="ghost"
          onClick={handleToggle}
        >
          {isEnabled ? (
            <BellRingIcon className="size-3.5 text-primary" />
          ) : (
            <BellIcon className="size-3.5 text-amber-500" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isEnabled ? "点击关闭桌面通知" : "点击开启桌面通知"}
      </TooltipContent>
    </Tooltip>
  );
}

export const NotificationToggle = PureNotificationToggle;
