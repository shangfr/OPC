"use client";

import { ArrowLeftIcon, CheckCircle, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "motion/react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 客户端邮箱格式校验，避免无效请求
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("请输入有效的邮箱地址");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "请求失败，请重试");
        return;
      }

      setSent(true);

      // Mock 模式下显示重置链接
      if (data.resetLink) {
        toast.info(`重置链接: ${data.resetLink}`, { duration: 15000 });
      }
    } catch {
      setError("网络错误，请稍后重试");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <>
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="text-[28px] font-bold tracking-tight text-center"
        >
          邮件已发送
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="mt-6 flex flex-col items-center text-center"
        >
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-emerald-500/10">
            <CheckCircle className="size-8 text-emerald-500" />
          </div>
          <p className="max-w-xs text-sm text-muted-foreground leading-relaxed">
            如果该邮箱已注册，您将收到一封包含重置密码链接的邮件。
          </p>
          <p className="mt-6">
            <Link
              className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              href="/login"
            >
              <ArrowLeftIcon className="mr-1 inline-block size-3" />
              返回登录
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
        忘记密码
      </h1>
      <p
        className="auth-slide-in text-[15px] text-muted-foreground/80 text-center"
        style={{ animationDelay: "0.18s" }}
      >
        输入您的邮箱，我们将发送重置密码的链接
      </p>
      <div
        className="auth-slide-in mt-5 w-full"
        style={{ animationDelay: "0.28s" }}
      >
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label className="text-[13px] font-medium text-foreground/80" htmlFor="email">
              邮箱
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                autoComplete="email"
                autoFocus
                className="h-11 pl-10"
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
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

          <Button
            className="relative h-11"
            disabled={loading}
            type="submit"
            variant="gradient"
          >
            {loading ? "发送中..." : "发送重置链接"}
          </Button>

          <p className="text-center text-[13px]">
            <Link
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              href="/login"
            >
              <ArrowLeftIcon className="mr-1 inline-block size-3" />
              返回登录
            </Link>
          </p>
        </form>
      </div>
    </>
  );
}
