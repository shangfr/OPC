"use client";

import { useEffect } from "react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Auth Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 text-center">
      <h2 className="text-lg font-semibold text-foreground">页面出现了问题</h2>
      <p className="max-w-xs text-sm text-muted-foreground">
        {error.message || "认证页面遇到了未知错误，请尝试重新加载。"}
      </p>
      <button
        className="mt-1 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        onClick={reset}
        type="button"
      >
        重新加载
      </button>
    </div>
  );
}
