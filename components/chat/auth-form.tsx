"use client";

import Form from "next/form";
import { useState } from "react";
import { Lock, Mail, Eye, EyeOff } from "lucide-react";

import { Input } from "../ui/input";
import { Label } from "../ui/label";

export function AuthForm({
  action,
  children,
  defaultEmail = "",
  error,
  passwordValue,
  onPasswordChange,
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
  error?: string | null;
  passwordValue?: string;
  onPasswordChange?: (value: string) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Form action={action} className="flex flex-col gap-4">
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
            defaultValue={defaultEmail}
            id="email"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-[13px] font-medium text-foreground/80" htmlFor="password">
          密码
        </Label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
          <Input
            autoComplete="current-password"
            className="h-11 pl-10 pr-10"
            id="password"
            name="password"
            placeholder="••••••••"
            required
            type={showPassword ? "text" : "password"}
            {...(passwordValue !== undefined
              ? { value: passwordValue, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onPasswordChange?.(e.target.value) }
              : {})}
          />
          <button
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
            aria-pressed={showPassword}
            className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            onClick={() => setShowPassword((v) => !v)}
            type="button"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {error && (
        <div
          aria-live="assertive"
          className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {children}
    </Form>
  );
}
