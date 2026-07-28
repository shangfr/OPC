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
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { type RegisterActionState, register } from "../actions";

// 密码强度计算
function getPasswordStrength(password: string): { level: 0 | 1 | 2 | 3; label: string } {
  if (!password) return { level: 0, label: "" };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;
  if (score <= 1) return { level: 1, label: "弱" };
  if (score === 2) return { level: 2, label: "中" };
  return { level: 3, label: "强" };
}

export default function Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirectUrl") || "/";
  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [authMode, setAuthMode] = useState<"email" | "phone">("phone");
  const [agreed, setAgreed] = useState(false);
  const [password, setPassword] = useState("");

  const [state, formAction] = useActionState<RegisterActionState, FormData>(
    register,
    { status: "idle" }
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: router is a stable ref
  useEffect(() => {
    if (state.status === "user_exists") {
      toast({ type: "error", description: state.message || "该邮箱已被注册" });
    } else if (state.status === "failed") {
      toast({
        type: "error",
        description: state.message || "创建账号失败",
      });
    } else if (state.status === "invalid_data") {
      toast({
        type: "error",
        description: state.message || "提交数据验证失败",
      });
    } else if (state.status === "success") {
      toast({ type: "success", description: "账号创建成功" });
      setIsSuccessful(true);
      router.refresh();
      router.push(redirectUrl);
    }
  }, [state.status, state.message, router, redirectUrl]);

  const handleSubmit = (formData: FormData) => {
    if (!agreed) {
      toast({ type: "error", description: "请先同意用户协议和隐私政策" });
      return;
    }
    setEmail(formData.get("email") as string);
    formAction(formData);
  };

  const handleSocialRegister = (provider: string) => {
    toast({
      type: "info",
      description: `${provider}注册暂未接入，请使用手机号或邮箱注册`,
    });
  };

  const strength = getPasswordStrength(password);

  return (
    <>
      <h1
        className="auth-slide-in text-[28px] font-bold tracking-tight text-center"
        style={{ animationDelay: "0.1s" }}
      >
        创建账号
      </h1>
      <p
        className="auth-slide-in text-[15px] text-muted-foreground/80 text-center"
        style={{ animationDelay: "0.18s" }}
      >
        免费注册，立即体验
      </p>

      {/* 注册方式切换 Tab — 使用 shadcn Tabs 组件 */}
      <Tabs
        value={authMode}
        onValueChange={(v) => setAuthMode(v as "email" | "phone")}
        className="auth-slide-in mt-5 w-full"
        style={{ animationDelay: "0.24s" } as React.CSSProperties}
      >
        <TabsList variant="line" className="w-full">
          <TabsTrigger value="phone" className="flex-1">
            手机号注册
          </TabsTrigger>
          <TabsTrigger value="email" className="flex-1">
            邮箱注册
          </TabsTrigger>
        </TabsList>

        <TabsContent value="phone" className="mt-4">
          <div className="flex flex-col gap-4">
            <PhoneAuthForm mode="register" />
            <p className="text-center text-[13px] text-muted-foreground">
              {"已有账号？"}
              <Link
                className="text-foreground underline-offset-4 hover:underline"
                href={`/login${redirectUrl !== "/" ? `?redirectUrl=${encodeURIComponent(redirectUrl)}` : ""}`}
              >
                登录
              </Link>
            </p>
            <p className="text-center text-[13px] text-muted-foreground">
              {"企业用户？"}
              <Link
                className="text-foreground underline-offset-4 hover:underline"
                href="/register-enterprise"
              >
                企业注册
              </Link>
            </p>
          </div>
        </TabsContent>

        <TabsContent value="email" className="mt-4">
          <AuthForm
            action={handleSubmit}
            defaultEmail={email}
            error={state.message}
            passwordValue={password}
            onPasswordChange={setPassword}
          >
            {/* 密码强度指示器 */}
            {password && (
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1 w-8 rounded-full transition-colors",
                        i < strength.level
                          ? strength.level === 1
                            ? "bg-red-500"
                            : strength.level === 2
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                          : "bg-muted"
                      )}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {strength.label}
                </span>
              </div>
            )}
            <div className="flex flex-col gap-3">
              {/* 使用 shadcn Checkbox 组件 */}
              <label className="flex items-start gap-2 text-[13px] text-muted-foreground cursor-pointer">
                <Checkbox
                  checked={agreed}
                  onCheckedChange={(v) => setAgreed(v === true)}
                  className="mt-0.5"
                />
                <span>
                  我已阅读并同意
                  <Link href="/terms" className="text-primary underline-offset-2 hover:underline">
                    《用户协议》
                  </Link>
                  和
                  <Link href="/privacy" className="text-primary underline-offset-2 hover:underline">
                    《隐私政策》
                  </Link>
                </span>
              </label>
              <SubmitButton isSuccessful={isSuccessful}>注册</SubmitButton>
              <p className="text-center text-[13px] text-muted-foreground">
                {"已有账号？"}
                <Link
                  className="text-foreground underline-offset-4 hover:underline"
                  href={`/login${redirectUrl !== "/" ? `?redirectUrl=${encodeURIComponent(redirectUrl)}` : ""}`}
                >
                  登录
                </Link>
              </p>
              <p className="text-center text-[13px] text-muted-foreground">
                {"企业用户？"}
                <Link
                  className="text-foreground underline-offset-4 hover:underline"
                  href="/register-enterprise"
                >
                  企业注册
                </Link>
              </p>
            </div>
          </AuthForm>
        </TabsContent>
      </Tabs>

      {/* 第三方注册（Mock） */}
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
              其他注册方式
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => handleSocialRegister("微信")}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#07c160]/30 bg-background text-sm font-medium transition-colors hover:border-[#07c160] hover:bg-[#07c160]/5"
            aria-label="微信注册"
          >
            <svg className="size-4 text-[#07c160]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.691 2C4.768 2 1.5 4.85 1.5 8.34c0 2.02 1.05 3.81 2.68 5.02L3.5 16l2.66-1.42c.81.23 1.66.36 2.53.36.26 0 .51-.01.76-.04-.16-.53-.25-1.09-.25-1.67 0-3.5 3.27-6.34 7.3-6.34.26 0 .51.01.76.04C16.78 3.87 13.1 2 8.691 2zm-2.6 4.2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm5.2 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm4.91 4.5c-3.58 0-6.5 2.57-6.5 5.75 0 3.18 2.92 5.75 6.5 5.75.68 0 1.34-.1 1.96-.27L21.5 23l-.5-1.85c1.5-1.06 2.5-2.69 2.5-4.52 0-3.18-2.92-5.75-6.5-5.75zm-2.5 3.5c.41 0 .75.34.75.75s-.34.75-.75.75-.75-.34-.75-.75.34-.75.75-.75zm5 0c.41 0 .75.34.75.75s-.34.75-.75.75-.75-.34-.75-.75.34-.75.75-.75z"/>
            </svg>
            微信注册
          </button>
          <button
            type="button"
            onClick={() => handleSocialRegister("GitHub")}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background text-sm font-medium transition-colors hover:border-foreground/30 hover:bg-muted"
            aria-label="GitHub 注册"
          >
            <Github className="size-4 text-foreground" />
            GitHub 注册
          </button>
        </div>
      </div>
    </>
  );
}
