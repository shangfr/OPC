// components/theme-toggle.tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // 或返回一个占位符
  }

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors hover:bg-muted"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="size-5 text-muted-foreground" />
      ) : (
        <Moon className="size-5 text-muted-foreground" />
      )}
      <div className="flex-1">
        <p className="text-sm font-medium">
          切换{resolvedTheme === "light" ? "暗色" : "亮色"}模式
        </p>
        <p className="text-xs text-muted-foreground">
          当前为{resolvedTheme === "light" ? "亮色" : "暗色"}模式
        </p>
      </div>
    </button>
  );
}
