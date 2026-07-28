"use client";

import { Github } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { AuthForm } from "@/components/chat/auth-form";
import { PhoneAuthForm } from "@/components/chat/phone-auth-form";
import { SubmitButton } from "@/components/chat/submit-button";
import { toast } from "@/components/chat/toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { type LoginActionState, login } from "../actions";

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirectUrl") || "/";
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
      router.refresh();
      router.push(redirectUrl);
    }
  }, [state.status, state.message, router, redirectUrl]);

  const handleSubmit = (formData: FormData) => {
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  const handleSocialLogin = (provider: string) => {
    toast({
      type: "info",
      description: `${provider}登录暂未接入，请使用手机号或邮箱登录`,
    });
  };

  return (
    <>
      <h1
        className="auth-slide-in text-[28px] font-bold tracking-tight text-center"
        style={{ animationDelay: "0.1s" }}
      >
        欢迎回来
      </h1>
      <p
        className="auth-slide-in text-[15px] text-muted-foreground/80 text-center"
        style={{ animationDelay: "0.18s" }}
      >
        登录您的账号以继续
      </p>

      {/* 登录方式切换 Tab — 使用 default 变体（胶囊式），激活态有明显背景 */}
      <Tabs
        value={authMode}
        onValueChange={(v) => setAuthMode(v as "email" | "phone")}
        className="auth-slide-in mt-5 w-full"
      >
        <TabsList className="h-10 w-full">
          <TabsTrigger value="phone" className="flex-1 text-sm">
            手机号登录
          </TabsTrigger>
          <TabsTrigger value="email" className="flex-1 text-sm">
            邮箱登录
          </TabsTrigger>
        </TabsList>

        <TabsContent value="phone" className="mt-4">
          <div className="flex flex-col gap-4">
            <PhoneAuthForm mode="login" />
            <div className="flex items-center justify-between text-[13px]">
              <Link
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                href={`/register${redirectUrl !== "/" ? `?redirectUrl=${encodeURIComponent(redirectUrl)}` : ""}`}
              >
                没有账号？去注册
              </Link>
              <Link
                className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                href="/forgot-password"
              >
                忘记密码？
              </Link>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="email" className="mt-4">
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
                  href={`/register${redirectUrl !== "/" ? `?redirectUrl=${encodeURIComponent(redirectUrl)}` : ""}`}
                >
                  注册
                </Link>
              </div>
            </div>
          </AuthForm>
        </TabsContent>
      </Tabs>

      {/* 第三方登录（Mock） */}
      <div
        className="auth-slide-in mt-6"
        style={{ animationDelay: "0.32s" }}
      >
        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-[11px]">
            <span className="bg-background px-3 text-muted-foreground">
              其他登录方式
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handleSocialLogin("微信")}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#07c160]/30 bg-background text-sm font-medium transition-colors hover:border-[#07c160] hover:bg-[#07c160]/5"
            aria-label="微信登录"
          >
            <svg className="size-4 text-[#07c160]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.691 2C4.768 2 1.5 4.85 1.5 8.34c0 2.02 1.05 3.81 2.68 5.02L3.5 16l2.66-1.42c.81.23 1.66.36 2.53.36.26 0 .51-.01.76-.04-.16-.53-.25-1.09-.25-1.67 0-3.5 3.27-6.34 7.3-6.34.26 0 .51.01.76.04C16.78 3.87 13.1 2 8.691 2zm-2.6 4.2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm5.2 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm4.91 4.5c-3.58 0-6.5 2.57-6.5 5.75 0 3.18 2.92 5.75 6.5 5.75.68 0 1.34-.1 1.96-.27L21.5 23l-.5-1.85c1.5-1.06 2.5-2.69 2.5-4.52 0-3.18-2.92-5.75-6.5-5.75zm-2.5 3.5c.41 0 .75.34.75.75s-.34.75-.75.75-.75-.34-.75-.75.34-.75.75-.75zm5 0c.41 0 .75.34.75.75s-.34.75-.75.75-.75-.34-.75-.75.34-.75.75-.75z"/>
            </svg>
            微信登录
          </button>
          <button
            type="button"
            onClick={() => handleSocialLogin("GitHub")}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium transition-colors hover:border-foreground/30 hover:bg-muted"
            aria-label="GitHub 登录"
          >
            <Github className="size-4 text-foreground" />
            GitHub 登录
          </button>
        </div>
      </div>

      {/* 用户协议 */}
      <p
        className="auth-slide-in mt-4 text-center text-[11px] text-muted-foreground/60"
        style={{ animationDelay: "0.36s" }}
      >
        登录即表示同意
        <Link href="/terms" className="underline-offset-2 hover:underline">
          《用户协议》
        </Link>
        和
        <Link href="/privacy" className="underline-offset-2 hover:underline">
          《隐私政策》
        </Link>
      </p>
    </>
  );
}
