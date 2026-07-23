"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { AuthForm } from "@/components/chat/auth-form";
import { PhoneAuthForm } from "@/components/chat/phone-auth-form";
import { SubmitButton } from "@/components/chat/submit-button";
import { toast } from "@/components/chat/toast";
import { cn } from "@/lib/utils";

// 静态生成：注册页为纯客户端交互，无需动态渲染
export const dynamic = "force-static";
import { type RegisterActionState, register } from "../actions";

export default function Page() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [isSuccessful, setIsSuccessful] = useState(false);
  const [authMode, setAuthMode] = useState<"email" | "phone">("phone");

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
      // Auth.js v5 纯 Server Component 模式：router.refresh() 触发重新调用 auth()
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
        创建账号
      </h1>
      <p
        className="auth-slide-in text-sm text-muted-foreground text-center"
        style={{ animationDelay: "0.18s" }}
      >
        免费注册，立即体验
      </p>

      {/* 注册方式切换 Tab */}
      <div
        className="auth-slide-in mt-6 flex w-full rounded-xl border border-border/50 bg-muted/40 p-1"
        style={{ animationDelay: "0.24s" }}
      >
        <button
          className={cn(
            "flex-1 rounded-lg py-2 text-xs font-medium transition-all duration-200",
            authMode === "phone"
              ? "bg-background text-primary shadow-sm ring-1 ring-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
          onClick={() => setAuthMode("phone")}
          type="button"
        >
          手机号注册
        </button>
        <button
          className={cn(
            "flex-1 rounded-lg py-2 text-xs font-medium transition-all duration-200",
            authMode === "email"
              ? "bg-background text-primary shadow-sm ring-1 ring-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-background/50"
          )}
          onClick={() => setAuthMode("email")}
          type="button"
        >
          邮箱注册
        </button>
      </div>

      <div
        className="auth-slide-in w-full"
        style={{ animationDelay: "0.28s" }}
      >
        {authMode === "phone" ? (
          <div className="flex flex-col gap-4">
            <PhoneAuthForm mode="register" />
            <p className="text-center text-[13px] text-muted-foreground">
              {"已有账号？"}
              <Link
                className="text-foreground underline-offset-4 hover:underline"
                href="/login"
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
        ) : (
          <AuthForm
            action={handleSubmit}
            defaultEmail={email}
            error={state.message}
          >
            <SubmitButton isSuccessful={isSuccessful}>注册</SubmitButton>
            <p className="text-center text-[13px] text-muted-foreground">
              {"已有账号？"}
              <Link
                className="text-foreground underline-offset-4 hover:underline"
                href="/login"
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
          </AuthForm>
        )}
      </div>
    </>
  );
}
