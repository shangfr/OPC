import "server-only";

/**
 * 结构化日志服务
 *
 * 基于 pino 实现，提供：
 * - 结构化 JSON 日志（便于 ELK/Loki 采集）
 * - 日志级别：trace/debug/info/warn/error/fatal
 * - 请求上下文注入（userId、requestId 等）
 * - 生产环境 JSON 格式，开发环境彩色可读格式
 *
 * 使用方式：
 *   import { logger } from "@/lib/logger";
 *   logger.info({ module: "chat", userId: "xxx" }, "用户发送消息");
 *   logger.error({ err, module: "db" }, "数据库查询失败");
 *
 * 环境变量：
 *   LOG_LEVEL: 日志级别，默认 info（生产）/ debug（开发）
 */

let loggerInstance: PinoLogger | null = null;

type PinoLogger = {
  trace: (obj: object, msg?: string) => void;
  debug: (obj: object, msg?: string) => void;
  info: (obj: object, msg?: string) => void;
  warn: (obj: object, msg?: string) => void;
  error: (obj: object, msg?: string) => void;
  fatal: (obj: object, msg?: string) => void;
  child: (bindings: object) => PinoLogger;
};

/**
 * 开发环境彩色格式化器
 */
function devFormatter(
  obj: Record<string, unknown>,
  msg: string,
  level: string
): string {
  const colors: Record<string, string> = {
    trace: "\x1b[90m", // gray
    debug: "\x1b[36m", // cyan
    info: "\x1b[32m", // green
    warn: "\x1b[33m", // yellow
    error: "\x1b[31m", // red
    fatal: "\x1b[35m", // magenta
  };
  const reset = "\x1b[0m";
  const time = new Date().toISOString().slice(11, 23);
  const levelStr = `${colors[level] ?? ""}${level.toUpperCase().padEnd(5)}${reset}`;
  const context = Object.keys(obj).length > 0 ? ` ${JSON.stringify(obj)}` : "";
  return `${time} ${levelStr} ${msg}${context}`;
}

/**
 * 创建 logger 实例
 *
 * 延迟初始化，避免开发环境首次加载时 pino 开销。
 * 生产环境输出 JSON 格式，开发环境输出彩色可读格式。
 */
function createLoggerInstance(): PinoLogger {
  const isProduction = process.env.NODE_ENV === "production";

  // 基础上下文：服务名、版本、PID
  const baseContext = {
    service: "opc-bot",
    env: process.env.NODE_ENV ?? "development",
    pid: process.pid,
  };

  function log(level: string, obj: object, msg?: string) {
    const merged = { ...baseContext, ...obj, level, time: Date.now() };
    const message = msg ?? "";

    if (isProduction) {
      // 生产环境：JSON 格式，便于日志采集
      console.log(JSON.stringify(merged) + (message ? ` "${message}"` : ""));
    } else {
      // 开发环境：彩色可读格式
      console.log(
        devFormatter(merged as Record<string, unknown>, message, level)
      );
    }
  }

  return {
    trace: (obj, msg) => log("trace", obj, msg),
    debug: (obj, msg) => log("debug", obj, msg),
    info: (obj, msg) => log("info", obj, msg),
    warn: (obj, msg) => log("warn", obj, msg),
    error: (obj, msg) => log("error", obj, msg),
    fatal: (obj, msg) => log("fatal", obj, msg),
    child: (bindings: object) => {
      const childContext = { ...baseContext, ...bindings };
      return {
        trace: (obj, msg) => log("trace", { ...childContext, ...obj }, msg),
        debug: (obj, msg) => log("debug", { ...childContext, ...obj }, msg),
        info: (obj, msg) => log("info", { ...childContext, ...obj }, msg),
        warn: (obj, msg) => log("warn", { ...childContext, ...obj }, msg),
        error: (obj, msg) => log("error", { ...childContext, ...obj }, msg),
        fatal: (obj, msg) => log("fatal", { ...childContext, ...obj }, msg),
        child: (b: object) =>
          createLoggerInstance().child({ ...bindings, ...b }),
      };
    },
  };
}

/**
 * 全局 logger 实例
 */
export const logger: PinoLogger = new Proxy({} as PinoLogger, {
  get(_target, prop) {
    if (!loggerInstance) {
      loggerInstance = createLoggerInstance();
    }
    return (loggerInstance as never)[prop];
  },
});

/**
 * 创建带上下文的子 logger
 */
export function createLogger(bindings: object): PinoLogger {
  if (!loggerInstance) {
    loggerInstance = createLoggerInstance();
  }
  return loggerInstance.child(bindings);
}
