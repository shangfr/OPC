"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="zh-CN">
      <body className="antialiased">
        <div className="flex h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
            <svg
              className="size-8 text-destructive"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-lg font-semibold text-foreground">
              应用发生了错误
            </h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              页面加载时遇到了未知错误，请尝试重新加载。
            </p>
          </div>
          <button
            className="mt-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            onClick={reset}
            type="button"
          >
            重新加载
          </button>
        </div>
      </body>
    </html>
  );
}
