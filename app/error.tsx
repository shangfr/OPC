"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="text-7xl font-bold text-muted-foreground/20">500</div>
      <h1 className="text-2xl font-semibold tracking-tight">出错了</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "页面遇到了未知错误，请尝试重新加载。"}
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          type="button"
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          重新加载
        </button>
        <Link
          href="/"
          className="rounded-lg border border-border px-5 py-2.5 text-sm font-medium transition-colors hover:bg-muted"
        >
          返回首页
        </Link>
      </div>
    </div>
  );
}
