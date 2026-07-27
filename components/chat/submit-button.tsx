"use client";

import { useFormStatus } from "react-dom";
import { Check, LoaderIcon } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  isSuccessful,
}: {
  children: React.ReactNode;
  isSuccessful: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-disabled={pending || isSuccessful}
      className={cn(
        "relative h-11 w-full text-[15px] font-medium transition-all",
        isSuccessful && "bg-emerald-500 text-white hover:bg-emerald-500"
      )}
      disabled={pending || isSuccessful}
      type={pending ? "button" : "submit"}
      variant="gradient"
    >
      {isSuccessful ? (
        <motion.span
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex items-center gap-1.5"
        >
          <Check className="size-4" />
          成功
        </motion.span>
      ) : (
        children
      )}

      {pending && !isSuccessful && (
        <span className="absolute right-4 animate-spin">
          <LoaderIcon />
        </span>
      )}

      <output aria-live="polite" className="sr-only">
        {pending || isSuccessful ? "加载中" : "提交表单"}
      </output>
    </Button>
  );
}
