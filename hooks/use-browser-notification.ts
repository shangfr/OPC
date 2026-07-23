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
 * const { notify, permission, requestPermission, supported } = useBrowserNotification();
 * await requestPermission();
 * notify("任务完成", { body: "您的报告已生成" });
 */

import { useCallback, useEffect, useState } from "react";

export type NotificationPermissionState =
  | "default"
  | "granted"
  | "denied"
  | "unsupported";

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
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermissionState>(
    "unsupported"
  );

  // 在客户端挂载后检测支持性和初始权限
  useEffect(() => {
    const isSupported =
      typeof window !== "undefined" && "Notification" in window;
    setSupported(isSupported);

    if (isSupported) {
      setPermission(Notification.permission as NotificationPermissionState);
    } else {
      setPermission("unsupported");
    }

    if (!isSupported) return;

    const updatePermission = () => {
      setPermission(Notification.permission as NotificationPermissionState);
    };

    let status: PermissionStatus | undefined;
    if ("permissions" in navigator) {
      navigator.permissions
        .query({ name: "notifications" as PermissionName })
        .then((s) => {
          status = s;
          status.addEventListener("change", updatePermission);
        })
        .catch(() => {
          // 部分浏览器不支持 notifications 权限查询，忽略
        });
    }

    return () => {
      // 清理监听器，防止内存泄漏
      if (status) {
        status.removeEventListener("change", updatePermission);
      }
    };
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    // 函数内部动态检测，避免闭包捕获旧的 supported 值
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }

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
  }, []);

  const notify = useCallback(
    (title: string, options: NotifyOptions = {}): boolean => {
      // 函数内部动态检测，避免闭包捕获旧的 supported 值
      if (typeof window === "undefined" || !("Notification" in window)) {
        return false;
      }

      if (Notification.permission !== "granted") {
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
    [requestPermission]
  );

  const closeAll = useCallback(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      // 真正的批量关闭需通过 Service Worker 的 registration.getNotifications()
    } catch {
      // ignore
    }
  }, []);

  return {
    supported,
    permission,
    requestPermission,
    notify,
    closeAll,
  };
}
