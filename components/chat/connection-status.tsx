"use client";

import { useEffect, useState } from "react";

/**
 * 连接状态指示器
 *
 * 监听浏览器的 online/offline 事件，在网络断开时显示醒目的横幅提示，
 * 帮助用户理解"为什么消息发不出去"，避免误以为是应用故障。
 *
 * 无障碍：使用 role="status" + aria-live="polite"，屏幕阅读器会在状态
 * 变化时朗读提示，且不会打断用户当前操作。
 */
export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // 初始化时同步当前状态
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (isOnline) {
    return null;
  }

  return (
    <output
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3"
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 shadow-lg dark:border-amber-900/50 dark:bg-amber-950/80 dark:text-amber-200">
        <span aria-hidden="true" className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-500" />
        </span>
        网络连接已断开，请检查网络后重试
      </div>
    </output>
  );
}
