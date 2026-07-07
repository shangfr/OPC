"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useState } from "react";
import { SubmitButton } from "@/components/chat/submit-button";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const [password, setPassword] = useState("");
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
        <h1
          className="auth-slide-in text-2xl font-semibold tracking-tight text-center"
          style={{ animationDelay: "0.1s" }}
        >
          密码已重置
        </h1>
        <div
          className="auth-slide-in mt-4 text-center"
          style={{ animationDelay: "0.2s" }}
        >
          <p className="text-sm text-muted-foreground leading-relaxed">
            密码已重置成功，请使用新密码登录。
          </p>
          <p className="mt-6">
            <Link
              className="text-[13px] font-medium text-foreground underline-offset-4 hover:underline"
              href="/login"
            >
              前往登录
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
        设置新密码
      </h1>
      <p
        className="auth-slide-in text-sm text-muted-foreground text-center"
        style={{ animationDelay: "0.18s" }}
      >
        请输入您的新密码
      </p>
      <div className="auth-slide-in w-full" style={{ animationDelay: "0.28s" }}>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label
              className="font-normal text-muted-foreground text-sm"
              htmlFor="password"
            >
              新密码
            </label>
            <input
              autoComplete="new-password"
              autoFocus
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              id="password"
              minLength={6}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 个字符"
              required
              type="password"
              value={password}
            />
          </div>

          {error && (
            <p className="text-[13px] text-red-500 leading-relaxed">{error}</p>
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
