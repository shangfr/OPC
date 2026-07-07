"use client"
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

/**
 * 定价页提交按钮
 * 使用 react-dom 的 useFormStatus 展示跳转/升级中的 loading 状态。
 */
export function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          正在处理...
        </>
      ) : (
        "升级套餐"
      )}
    </button>
  );
}
