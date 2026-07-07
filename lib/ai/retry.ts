const RETRYABLE_ERROR_MESSAGES = [
  "ECONNRESET",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNREFUSED",
  "fetch failed",
  "network",
  "timeout",
  "Too Many Requests",
  "Service Unavailable",
  "Internal Server Error",
  "Bad Gateway",
  "Gateway Timeout",
];

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return RETRYABLE_ERROR_MESSAGES.some((m) =>
      message.includes(m.toLowerCase())
    );
  }
  return false;
}

function getRetryDelayMs(attempt: number): number {
  // Exponential backoff: 1s, 2s, 4s + random jitter (0-500ms)
  const baseDelay = 1000 * 2 ** attempt;
  const jitter = Math.random() * 500;
  return baseDelay + jitter;
}

/**
 * Retry an async operation with exponential backoff.
 * Retries on transient network errors and HTTP 429/5xx responses.
 */
export async function withRetry<T>(
  fn: () => T | Promise<T>,
  maxRetries = 2,
  onRetry?: (attempt: number, error: unknown, delayMs: number) => void
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= maxRetries || !isRetryableError(error)) {
        throw error;
      }

      const delayMs = getRetryDelayMs(attempt);
      onRetry?.(attempt + 1, error, delayMs);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
