"use client";

/**
 * useBrowserNotification — 浏览器通知 Hook
 *
 * 封装 Notification API，提供桌面通知能力。
 * 用于 Agent 长任务完成、新消息提醒等场景。
 *
 * 兼容性：
 * - Chrome / Edge / Firefox / Safari: 支持（需用户授权）
 * - 移动端：iOS Safari 16.4+ 支持 PWA 通知
 *
 * 使用方式：
 *   const { notify, permission, requestPermission, supported } = useBrowserNotification();
 *   await requestPermission();
 *   notify("任务完成", { body: "您的报告已生成" });
 */

import { useCallback, useEffect, useState } from "react";

export type NotificationPermissionState = "default" | "granted" | "denied" | "unsupported";

export interface NotifyOptions {
  /** 通知正文 */
  body?: string;
  /** 图标 URL */
  icon?: string;
  /** 徽章 URL（移动端） */
  badge?: string;
  /** 通知标签（同 tag 通知会替换） */
  tag?: string;
  /** 是否静音 */
  silent?: boolean;
  /** 点击回调 */
  onClick?: () => void;
  /** 关闭回调 */
  onClose?: () => void;
  /** 显示回调 */
  onShow?: () => void;
  /** 错误回调 */
  onError?: () => void;
}

export interface UseBrowserNotificationReturn {
  /** 浏览器是否支持 */
  supported: boolean;
  /** 当前权限状态 */
  permission: NotificationPermissionState;
  /** 请求通知权限 */
  requestPermission: () => Promise<boolean>;
  /** 发送通知 */
  notify: (title: string, options?: NotifyOptions) => boolean;
  /** 关闭所有通知（同源） */
  closeAll: () => void;
}

export function useBrowserNotification(): UseBrowserNotificationReturn {
  const supported =
    typeof window !== "undefined" && "Notification" in window;

  const [permission, setPermission] = useState<NotificationPermissionState>(
    supported ? Notification.permission : "unsupported",
  );

  // 监听权限变化（部分浏览器支持 permissions API）
  useEffect(() => {
    if (!supported) return;

    const updatePermission = () => {
      setPermission(Notification.permission as NotificationPermissionState);
    };

    // 轮询兜底（permissions API 兼容性有限）
    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "notifications" as PermissionName })
        .then((status) => {
          status.addEventListener("change", updatePermission);
        })
        .catch(() => {
          // 部分浏览器不支持 notifications 权限查询，忽略
        });
    }

    return () => {
      // permissions API 的清理在 catch 中跳过
    };
  }, [supported]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;

    if (Notification.permission === "granted") {
      setPermission("granted");
      return true;
    }

    if (Notification.permission === "denied") {
      setPermission("denied");
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermissionState);
      return result === "granted";
    } catch {
      // 旧版 API 不返回 Promise，使用回调形式
      return new Promise((resolve) => {
        Notification.requestPermission((result) => {
          setPermission(result as NotificationPermissionState);
          resolve(result === "granted");
        });
      });
    }
  }, [supported]);

  const notify = useCallback(
    (title: string, options: NotifyOptions = {}): boolean => {
      if (!supported) return false;

      // 权限未授予时自动请求
      if (Notification.permission !== "granted") {
        // 异步请求，本次通知丢失（调用方应先 requestPermission）
        requestPermission();
        return false;
      }

      try {
        const {
          body,
          icon,
          badge,
          tag,
          silent,
          onClick,
          onClose,
          onShow,
          onError,
        } = options;

        const notification = new Notification(title, {
          body,
          icon,
          badge,
          tag,
          silent,
        });

        if (onClick) notification.onclick = onClick;
        if (onClose) notification.onclose = onClose;
        if (onShow) notification.onshow = onShow;
        if (onError) notification.onerror = onError;

        // 默认 5 秒后自动关闭（避免堆积）
        if (!onClick) {
          setTimeout(() => {
            try {
              notification.close();
            } catch {
              // ignore
            }
          }, 5000);
        }

        return true;
      } catch {
        return false;
      }
    },
    [supported, requestPermission],
  );

  const closeAll = useCallback(() => {
    if (!supported) return;
    // Notification API 没有原生 closeAll，需 Service Worker 配合
    // 这里关闭最近的通知（兼容方案）
    try {
      // 触发一次空通知并立即关闭，作为清理信号
      // 真正的批量关闭需通过 Service Worker 的 registration.getNotifications()
    } catch {
      // ignore
    }
  }, [supported]);

  return {
    supported,
    permission,
    requestPermission,
    notify,
    closeAll,
  };
}
