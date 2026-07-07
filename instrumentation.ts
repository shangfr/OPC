import { DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api";

export function register() {
  // Only initialize once in the Node.js runtime (skip edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    initOpenTelemetry();
  }
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
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { getNodeAutoInstrumentations } = await import(
      "@opentelemetry/auto-instrumentations-node"
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let traceExporter: any;

    if (otelEndpoint) {
      const { OTLPTraceExporter } = await import(
        "@opentelemetry/exporter-trace-otlp-http"
      );
      traceExporter = new OTLPTraceExporter({ url: otelEndpoint });
    } else {
      // Dev verbose mode: opt-in via OTEL_CONSOLE=true
      diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN);
      const { ConsoleSpanExporter } = await import(
        "@opentelemetry/sdk-trace-node"
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
            console.error("[OTel] Shutdown error:", error)
          );
      });
    }
  } catch (_error) {
    // SDK packages not available — silently skip
    if (!isProd) {
      console.warn(
        "[OTel] Tracing not initialized. Install SDK packages to enable:",
        "@opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node"
      );
    }
  }
}
