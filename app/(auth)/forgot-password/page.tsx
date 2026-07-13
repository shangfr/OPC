"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LoaderIcon } from "@/components/chat/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

      // 仅在开发模式下显示重置链接，避免生产环境泄露
      if (data.resetLink && process.env.NODE_ENV === "development") {
        console.log("重置链接:", data.resetLink);
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
        <h1
          className="auth-slide-in text-2xl font-semibold tracking-tight text-center"
          style={{ animationDelay: "0.1s" }}
        >
          邮件已发送
        </h1>
        <div
          className="auth-slide-in mt-4 text-center"
          style={{ animationDelay: "0.2s" }}
        >
          <p className="text-sm text-muted-foreground leading-relaxed">
            如果该邮箱已注册，您将收到一封包含重置密码链接的邮件。
          </p>
          <p className="mt-6">
            <Link
              className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              href="/login"
            >
              返回登录
            </Link>
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      <h1
        className="auth-slide-in text-2xl font-semibold tracking-tight text-center"
        style={{ animationDelay: "0.1s" }}
      >
        忘记密码
      </h1>
      <p
        className="auth-slide-in text-sm text-muted-foreground text-center"
        style={{ animationDelay: "0.18s" }}
      >
        输入您的邮箱，我们将发送重置密码的链接
      </p>
      <div className="auth-slide-in w-full" style={{ animationDelay: "0.28s" }}>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <Label
              className="font-normal text-muted-foreground"
              htmlFor="email"
            >
              邮箱
            </Label>
            <Input
              autoComplete="email"
              autoFocus
              id="email"
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              type="email"
              value={email}
            />
          </div>

          {error && (
            <p className="text-[13px] text-destructive leading-relaxed">{error}</p>
          )}

          <Button
            className="relative"
            disabled={loading}
            type="submit"
          >
            {loading ? "发送中..." : "发送重置链接"}
            {loading && (
              <span className="absolute right-4 animate-spin">
                <LoaderIcon size={16} />
              </span>
            )}
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
