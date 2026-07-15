"use client";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 定价页提交按钮
 * 使用 react-dom 的 useFormStatus 展示跳转/升级中的 loading 状态。
 * 使用 shadcn Button 组件，支持动态文案（升级/降级/切换）。
 */
export function SubmitButton({
  label = "升级套餐",
  variant = "default",
}: {
  label?: string;
  variant?: "default" | "outline" | "destructive" | "secondary" | "ghost" | "link" | "soft";
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      variant={variant}
      className="w-full"
    >
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" />
          正在处理...
        </>
      ) : (
        label
      )}
    </Button>
  );
}
