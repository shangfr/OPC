import { DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";

/**
 * Next.js Instrumentation 钩子
 *
 * 在服务启动时执行一次，用于初始化：
 * - OpenTelemetry 分布式追踪
 * - Sentry 错误监控（通过 lib/sentry.ts 配置）
 *
 * Sentry 集成说明：
 * - 本文件不直接初始化 Sentry SDK（避免引入依赖）
 * - 错误上报通过 lib/sentry.ts 的 captureException 函数
 * - 安装 @sentry/nextjs 后，可在此处添加 Sentry.init()
 */
export async function register() {
  // Only initialize once in the Node.js runtime (skip edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await initOpenTelemetry();
    await initSentry();
  }
}

/**
 * 初始化 Sentry（可选）
 *
 * 未配置 SENTRY_DSN 时跳过。
 * 安装 @sentry/nextjs 后，可在此处添加：
 *   import * as Sentry from "@sentry/nextjs";
 *   Sentry.init({
 *     dsn: process.env.SENTRY_DSN,
 *     tracesSampleRate: 0.1,
 *   });
 */
async function initSentry() {
  const sentryDsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!sentryDsn) {
    return;
  }

  try {
    // TODO: 安装 @sentry/nextjs 后启用以下代码
    // const Sentry = await import("@sentry/nextjs");
    // Sentry.init({
    //   dsn: sentryDsn,
    //   environment: process.env.NODE_ENV,
    //   tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    //   release: process.env.SENTRY_RELEASE,
    // });

    if (process.env.NODE_ENV !== "production") {
      console.log("[Sentry] DSN 已配置，错误监控就绪");
    }
  } catch (error) {
    console.warn("[Sentry] 初始化失败:", error instanceof Error ? error.message : error);
  }
}

// 使用非静态可分析的动态 import，避免 bundler（webpack/turbopack）
// 在构建时尝试解析含原生绑定的 OpenTelemetry / gRPC 包。
// 这些包仅在运行时按需加载，不应被打包进 server bundle。
async function safeDynamicImport(moduleName: string): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const dynamicImport = new Function(
    "m",
    "return import(m)",
  ) as (m: string) => Promise<any>;
  return dynamicImport(moduleName);
}

async function initOpenTelemetry() {
  const isProd = process.env.NODE_ENV === "production";
  const otelEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const otelConsole = process.env.OTEL_CONSOLE === "true";

  // In dev mode: skip unless OTEL_CONSOLE=true (avoids noisy span output)
  if (!isProd && !otelConsole) {
    return;
  }

  // In prod: skip if no export target configured
  if (isProd && !otelEndpoint) {
    return;
  }

  try {
    const { NodeSDK } = await safeDynamicImport("@opentelemetry/sdk-node");
    const { getNodeAutoInstrumentations } = await safeDynamicImport(
      "@opentelemetry/auto-instrumentations-node",
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let traceExporter: any;

    if (otelEndpoint) {
      const { OTLPTraceExporter } = await safeDynamicImport(
        "@opentelemetry/exporter-trace-otlp-http",
      );
      traceExporter = new OTLPTraceExporter({ url: otelEndpoint });
    } else {
      // Dev verbose mode: opt-in via OTEL_CONSOLE=true
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
      const { ConsoleSpanExporter } = await safeDynamicImport(
        "@opentelemetry/sdk-trace-node",
      );
      traceExporter = new ConsoleSpanExporter();
    }

    const sdk = new NodeSDK({
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          "@opentelemetry/instrumentation-fs": { enabled: false },
          // HTTP instrumentation causes timing issues with Next.js dev server
          "@opentelemetry/instrumentation-http": { enabled: isProd },
        }),
      ],
    });

    sdk.start();

    // Graceful shutdown — guard for Edge Runtime compatibility
    if (typeof process.on === "function") {
      process.on("SIGTERM", () => {
        sdk
          .shutdown()
          .then(() => console.log("[OTel] Tracing terminated"))
          .catch((error: unknown) =>
            console.error("[OTel] Shutdown error:", error),
          );
      });
    }
  } catch (_error) {
    // SDK packages not available — silently skip
    if (!isProd) {
      console.warn(
        "[OTel] Tracing not initialized. Install SDK packages to enable:",
        "@opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node",
      );
    }
  }
}
