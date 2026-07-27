"use client";

import { Check, Lock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useState } from "react";
import { SubmitButton } from "@/components/chat/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "motion/react";

function ResetPasswordForm() {
  const params = useParams();
  const token = params.token as string;
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("密码至少需要 6 个字符");
      return;
    }

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "重置失败，请重试");
        return;
      }

      setSuccess(true);
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-[28px] font-bold tracking-tight text-center"
        >
          密码已重置
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6 flex flex-col items-center text-center"
        >
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
            <Check className="size-8 text-emerald-500" />
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            密码已重置成功，请使用新密码登录。
          </p>
          <p className="mt-6">
            <Link
              className="text-[13px] font-medium text-primary underline-offset-4 hover:underline"
              href="/login"
            >
              前往登录
            </Link>
          </p>
        </motion.div>
      </>
    );
  }

  return (
    <>
      <h1
        className="auth-slide-in text-[28px] font-bold tracking-tight text-center"
        style={{ animationDelay: "0.1s" }}
      >
        设置新密码
      </h1>
      <p
        className="auth-slide-in text-[15px] text-muted-foreground/80 text-center"
        style={{ animationDelay: "0.18s" }}
      >
        请输入您的新密码
      </p>
      <div
        className="auth-slide-in mt-5 w-full"
        style={{ animationDelay: "0.28s" }}
      >
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[13px] font-medium text-foreground/80" htmlFor="password">
              新密码
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                autoComplete="new-password"
                autoFocus
                className="h-11 pl-10"
                id="password"
                minLength={6}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 个字符"
                required
                type="password"
                value={password}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-[13px] font-medium text-foreground/80" htmlFor="confirmPassword">
              确认新密码
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                autoComplete="new-password"
                className="h-11 pl-10"
                id="confirmPassword"
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                required
                type="password"
                value={confirmPassword}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {error}
            </div>
          )}

          <SubmitButton isSuccessful={false}>
            {loading ? "重置中..." : "重置密码"}
          </SubmitButton>

          <p className="text-center text-[13px]">
            <Link
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              href="/login"
            >
              返回登录
            </Link>
          </p>
        </form>
      </div>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
