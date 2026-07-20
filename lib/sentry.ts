import "server-only";

/**
 * Sentry 错误监控配置
 *
 * 使用方式：
 * 1. 安装 SDK：pnpm add @sentry/nextjs
 * 2. 运行向导：npx @sentry/wizard@latest -i nextjs
 * 3. 配置环境变量：
 *    SENTRY_DSN=https://xxx@sentry.io/xxx
 *    SENTRY_AUTH_TOKEN=xxx
 *    NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
 *
 * 本文件提供轻量级错误上报接口，未安装 SDK 时自动降级为 console.error。
 * 安装 SDK 后，将 captureException 实现替换为 Sentry.captureException。
 */

interface SentryConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  tracesSampleRate?: number;
}

/**
 * 获取 Sentry 配置（从环境变量读取）
 */
function getSentryConfig(): SentryConfig {
  return {
    dsn: process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE ?? process.env.npm_package_version,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  };
}

/**
 * Sentry SDK 是否可用（已配置 DSN 且已安装 @sentry/nextjs）
 */
export function isSentryEnabled(): boolean {
  return Boolean(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/**
 * 捕获异常并上报到 Sentry
 *
 * 未安装 Sentry SDK 时，降级为 console.error。
 * 安装后，将此实现替换为：
 *   import * as Sentry from "@sentry/nextjs";
 *   export async function captureException(error: unknown, context?: Record<string, unknown>) {
 *     Sentry.captureException(error, { extra: context });
 *   }
 *
 * @param error 错误对象
 * @param context 额外上下文（userId、requestId、module 等）
 */
export async function captureException(
  error: unknown,
  context?: Record<string, unknown>
): Promise<void> {
  const config = getSentryConfig();

  if (!config.dsn) {
    // Sentry 未配置：降级为 console.error
    console.error("[captureException]", error, context);
    return;
  }

  // TODO: 安装 @sentry/nextjs 后启用以下代码
  // import * as Sentry from "@sentry/nextjs";
  // Sentry.captureException(error, {
  //   extra: context,
  //   tags: { module: context?.module as string },
  // });

  // 临时实现：通过 Sentry REST API 上报（无需 SDK）
  // 文档：https://docs.sentry.io/api/projects/store-an-event/
  try {
    const event = {
      message: error instanceof Error ? error.message : String(error),
      level: "error",
      environment: config.environment,
      release: config.release,
      exception: {
        values: [
          {
            type: error instanceof Error ? error.name : "Error",
            value: error instanceof Error ? error.message : String(error),
            stacktrace:
              error instanceof Error
                ? {
                    frames: (error.stack ?? "").split("\n").map((line, i) => ({
                      filename: line,
                      lineno: i,
                    })),
                  }
                : undefined,
          },
        ],
      },
      extra: context,
      timestamp: new Date().toISOString(),
    };

    // 解析 DSN: https://xxx@sentry.io/xxx
    const dsnMatch = config.dsn.match(/^https?:\/\/([^@]+)@([^/]+)\/(.+)$/);
    if (!dsnMatch) {
      return;
    }

    const [, publicKey, host, projectId] = dsnMatch;
    const url = `https://${host}/api/${projectId}/store/`;

    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": `Sentry sentry_version=7,sentry_key=${publicKey}`,
      },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {
      // 上报失败静默忽略，不影响业务
    });
  } catch {
    // 上报异常本身失败时静默忽略
  }
}

/**
 * 捕获用户消息（用于面包屑 breadcrumb）
 *
 * @param message 消息内容
 * @param category 分类（如 "ui"、"network"、"db"）
 * @param level 级别（info/warning/error）
 */
export function captureMessage(
  message: string,
  category?: string,
  level: "info" | "warning" | "error" = "info"
): void {
  const config = getSentryConfig();
  if (!config.dsn) {
    console[level === "error" ? "error" : level === "warning" ? "warn" : "log"](
      `[${category ?? "message"}]`,
      message
    );
    return;
  }

  // TODO: 安装 @sentry/nextjs 后启用
  // import * as Sentry from "@sentry/nextjs";
  // Sentry.captureMessage(message, level);
}

/**
 * 设置用户上下文（登录后调用）
 *
 * @param userId 用户 ID
 * @param email 用户邮箱
 * @param username 用户名
 */
export function setUserContext(
  _userId?: string,
  _email?: string,
  _username?: string
): void {
  if (!isSentryEnabled()) {
    return;
  }

  // TODO: 安装 @sentry/nextjs 后启用
  // import * as Sentry from "@sentry/nextjs";
  // Sentry.setUser({
  //   id: userId,
  //   email: email,
  //   username: username,
  // });
}
