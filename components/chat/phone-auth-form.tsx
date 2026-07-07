"use client";

import { Loader2, Phone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  type PhoneActionState,
  loginByPhone,
  registerByPhone,
} from "@/app/(auth)/actions";
import { cn } from "@/lib/utils";

interface PhoneAuthFormProps {
  mode: "login" | "register";
}

export function PhoneAuthForm({ mode }: PhoneAuthFormProps) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const action = mode === "login" ? loginByPhone : registerByPhone;

  const [state, formAction] = useActionState<PhoneActionState, FormData>(
    action,
    { status: "idle" }
  );

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // 处理 action 返回状态
  useEffect(() => {
    if (state.status === "success") {
      toast.success(mode === "login" ? "登录成功" : "注册成功");
      router.refresh();
      router.push("/");
    } else if (state.status === "user_exists") {
      toast.error(state.message ?? "该手机号已注册");
    } else if (state.status === "user_not_found") {
      toast.error(state.message ?? "该手机号未注册");
    } else if (state.status === "code_invalid") {
      toast.error(state.message ?? "验证码错误或已过期");
    } else if (state.status === "invalid_data") {
      toast.error(state.message ?? "输入有误");
    } else if (state.status === "failed") {
      toast.error(state.message ?? "操作失败，请重试");
    }
  }, [state, mode, router]);

  // 发送验证码
  const handleSendCode = async () => {
    if (!/^1[3-9]\d{9}$/.test(phone.replace(/[\s-]/g, ""))) {
      toast.error("请输入正确的 11 位手机号");
      return;
    }

    if (countdown > 0) return;

    setSending(true);
    try {
      const res = await fetch("/api/phone/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.replace(/[\s-]/g, ""),
          purpose: mode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message ?? "验证码发送失败");
        return;
      }

      toast.success("验证码已发送，请查收短信");
      setCountdown(60);

      // 开发模式下显示验证码
      if (data.debugCode) {
        toast.info(`开发模式验证码: ${data.debugCode}`, { duration: 10000 });
      }
    } catch {
      toast.error("网络错误，请重试");
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (formData: FormData) => {
    formData.set("phone", phone.replace(/[\s-]/g, ""));
    formData.set("code", code);
    formAction(formData);
  };

  return (
    <form action={handleSubmit} className="flex w-full flex-col gap-4">
      {/* 手机号输入 */}
      <div className="flex flex-col gap-2">
        <label
          className="font-normal text-muted-foreground"
          htmlFor="phone-input"
        >
          手机号
        </label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
          <input
            autoComplete="tel"
            className="h-10 w-full rounded-lg border border-border bg-background pl-10 pr-3 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10"
            id="phone-input"
            inputMode="numeric"
            maxLength={11}
            name="phone"
            onChange={(e) => setPhone(e.target.value)}
            pattern="1[3-9]\d{9}"
            placeholder="请输入手机号"
            required
            type="tel"
            value={phone}
          />
        </div>
      </div>

      {/* 验证码输入 + 发送按钮 */}
      <div className="flex flex-col gap-2">
        <label
          className="font-normal text-muted-foreground"
          htmlFor="code-input"
        >
          验证码
        </label>
        <div className="flex gap-2">
          <input
            autoComplete="one-time-code"
            className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm transition-colors placeholder:text-muted-foreground/40 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10"
            id="code-input"
            inputMode="numeric"
            maxLength={6}
            name="code"
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="6 位验证码"
            required
            type="text"
            value={code}
          />
          <button
            className={cn(
              "h-10 shrink-0 rounded-lg border px-3 text-xs font-medium transition-colors",
              countdown > 0 || sending
                ? "border-border/50 text-muted-foreground/50"
                : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"
            )}
            disabled={countdown > 0 || sending || phone.length !== 11}
            onClick={handleSendCode}
            type="button"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : countdown > 0 ? (
              `${countdown}s`
            ) : (
              "获取验证码"
            )}
          </button>
        </div>
      </div>

      {/* 提交按钮 */}
      <button
        className="touch-target mt-2 inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        disabled={state.status === "in_progress" || phone.length !== 11 || code.length !== 6}
        type="submit"
      >
        {state.status === "in_progress" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : mode === "login" ? (
          "登录"
        ) : (
          "注册"
        )}
      </button>
    </form>
  );
}
