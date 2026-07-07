"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { AuthForm } from "@/components/chat/auth-form";
import { PhoneAuthForm } from "@/components/chat/phone-auth-form";
import { SubmitButton } from "@/components/chat/submit-button";
import { toast } from "@/components/chat/toast";
import { cn } from "@/lib/utils";
import { type LoginActionState, login } from "../actions";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [authMode, setAuthMode] = useState<"email" | "phone">("phone");

  const [state, formAction] = useActionState<LoginActionState, FormData>(
    login,
    { status: "idle" }
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: router is a stable ref
  useEffect(() => {
    if (state.status === "user_not_found") {
      toast({ type: "error", description: "该账号未注册，请先注册" });
    } else if (state.status === "wrong_password") {
      toast({ type: "error", description: "密码错误，请重试" });
    } else if (state.status === "failed") {
      toast({
        type: "error",
        description: state.message || "登录失败，请稍后重试",
      });
    } else if (state.status === "invalid_data") {
      toast({
        type: "error",
        description: state.message || "提交数据验证失败",
      });
    } else if (state.status === "success") {
      setIsSuccessful(true);
      // Auth.js v5 纯 Server Component 模式：
      // 登录成功后 router.refresh() 触发 Server Components 重新调用 auth() 获取新 session
      router.refresh();
      router.push("/");
    }
  }, [state.status]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  return (
    <>
      <h1
        className="auth-slide-in text-2xl font-semibold tracking-tight text-center"
        style={{ animationDelay: "0.1s" }}
      >
        欢迎回来
      </h1>
      <p
        className="auth-slide-in text-sm text-muted-foreground text-center"
        style={{ animationDelay: "0.18s" }}
      >
        登录您的账号以继续
      </p>

      {/* 登录方式切换 Tab */}
      <div
        className="auth-slide-in mt-6 flex w-full rounded-lg border border-border/50 bg-muted/30 p-1"
        style={{ animationDelay: "0.24s" }}
      >
        <button
          className={cn(
            "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
            authMode === "phone"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setAuthMode("phone")}
          type="button"
        >
          手机号登录
        </button>
        <button
          className={cn(
            "flex-1 rounded-md py-1.5 text-xs font-medium transition-colors",
            authMode === "email"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setAuthMode("email")}
          type="button"
        >
          邮箱登录
        </button>
      </div>

      <div
        className="auth-slide-in w-full"
        style={{ animationDelay: "0.28s" }}
      >
        {authMode === "phone" ? (
          <div className="flex flex-col gap-4">
            <PhoneAuthForm mode="login" />
            <div className="flex items-center justify-center text-[13px]">
              <Link
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                href="/register"
              >
                没有账号？去注册
              </Link>
            </div>
          </div>
        ) : (
          <AuthForm
            action={handleSubmit}
            defaultEmail={email}
            error={state.message}
          >
            <div className="flex flex-col gap-3">
              <SubmitButton isSuccessful={isSuccessful}>登录</SubmitButton>
              <div className="flex items-center justify-between text-[13px]">
                <Link
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  href="/forgot-password"
                >
                  忘记密码？
                </Link>
                <Link
                  className="text-foreground underline-offset-4 hover:underline"
                  href="/register"
                >
                  注册
                </Link>
              </div>
            </div>
          </AuthForm>
        )}
      </div>
    </>
  );
}
