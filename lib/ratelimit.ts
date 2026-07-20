import { createClient } from "redis";

import { isProductionEnvironment } from "@/lib/constants";
import { ChatbotError } from "@/lib/errors";

/**
 * 限流服务
 *
 * 基于 Redis 实现滑动窗口限流，支持：
 * - IP 级别限流（防恶意刷量）
 * - 用户级别限流（按套餐配额）
 * - 自定义 key 限流（如按 agentId）
 *
 * 降级策略：
 * - 未配置 REDIS_URL 时，所有检查直接通过（开发环境友好）
 * - Redis 连接失败时，记录日志但不阻塞请求（可用性优先）
 */

/** 默认 IP 限流：每小时 10 次（未登录用户） */
const DEFAULT_IP_MAX = 10;
const DEFAULT_IP_TTL = 60 * 60; // 1 小时

let client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (!client && process.env.REDIS_URL) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on("error", (err) => {
      console.warn("[ratelimit] Redis error:", err.message);
    });
    client.connect().catch((err) => {
      console.warn("[ratelimit] Redis connect failed:", err.message);
      client = null;
    });
  }
  return client;
}

/**
 * 通用限流检查
 */
export async function checkRateLimit(
  key: string,
  max: number,
  ttlSeconds: number
): Promise<{ count: number; remaining: number; resetAt: number }> {
  if (!isProductionEnvironment || !process.env.REDIS_URL) {
    return {
      count: 0,
      remaining: max,
      resetAt: Date.now() + ttlSeconds * 1000,
    };
  }

  const redis = getClient();
  if (!redis?.isReady) {
    return {
      count: 0,
      remaining: max,
      resetAt: Date.now() + ttlSeconds * 1000,
    };
  }

  try {
    const keyName = `ratelimit:${key}`;
    const [countResult] = await redis
      .multi()
      .incr(keyName)
      .expire(keyName, ttlSeconds, "NX")
      .exec();

    const count = typeof countResult === "number" ? countResult : 1;

    if (count > max) {
      throw new ChatbotError("rate_limit:chat");
    }

    return {
      count,
      remaining: Math.max(0, max - count),
      resetAt: Date.now() + ttlSeconds * 1000,
    };
  } catch (error) {
    if (error instanceof ChatbotError) {
      throw error;
    }
    console.warn("[ratelimit] check failed:", error);
    return {
      count: 0,
      remaining: max,
      resetAt: Date.now() + ttlSeconds * 1000,
    };
  }
}

/**
 * IP 级别限流（未登录用户防恶意刷量）
 */
export async function checkIpRateLimit(ip: string | undefined) {
  if (!ip) {
    return;
  }
  await checkRateLimit(`ip-rate-limit:${ip}`, DEFAULT_IP_MAX, DEFAULT_IP_TTL);
}

/**
 * 用户级别限流（按套餐配额）
 */
export async function checkUserRateLimit(userId: string, maxPerHour: number) {
  await checkRateLimit(`user-msg:${userId}`, maxPerHour, DEFAULT_IP_TTL);
}

/**
 * 从请求头提取客户端 IP
 */
export function getClientIp(request: Request): string | undefined {
  const headers = request.headers;
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    undefined
  );
}
