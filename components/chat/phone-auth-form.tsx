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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CodeInput } from "@/components/ui/code-input";

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

      toast.success("验证码已发送");
      setCountdown(60);

      // Mock 模式下显示验证码
      if (data.debugCode) {
        toast.info(`验证码: ${data.debugCode}（Mock 模式）`, { duration: 10000 });
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
      <div className="flex flex-col gap-1.5">
        <Label className="text-[13px] font-medium text-foreground/80" htmlFor="phone-input">
          手机号
        </Label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            autoComplete="tel"
            className="h-11 pl-10"
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

      {/* 验证码输入（6 格独立输入） */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-[13px] font-medium text-foreground/80" htmlFor="code-input">
            验证码
          </Label>
          <button
            type="button"
            onClick={handleSendCode}
            disabled={countdown > 0 || sending || phone.length !== 11}
            className={cn(
              "text-[13px] font-medium transition-colors",
              countdown > 0 || sending
                ? "text-muted-foreground/50"
                : "text-primary hover:text-primary/80"
            )}
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : countdown > 0 ? (
              `${countdown}s 后重发`
            ) : (
              "获取验证码"
            )}
          </button>
        </div>
        <CodeInput
          value={code}
          onChange={setCode}
          disabled={state.status === "in_progress"}
        />
      </div>

      {/* 提交按钮 */}
      <Button
        className="touch-target mt-1 h-11 w-full text-[15px] font-medium"
        disabled={state.status === "in_progress" || phone.length !== 11 || code.length !== 6}
        type="submit"
        variant="gradient"
      >
        {state.status === "in_progress" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : mode === "login" ? (
          "登录"
        ) : (
          "注册"
        )}
      </Button>
    </form>
  );
}
