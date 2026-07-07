"use client";

import Form from "next/form";
import { useState } from "react";

import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { EyeIcon, EyeOffIcon } from "./icons";

export function AuthForm({
  action,
  children,
  defaultEmail = "",
  error,
}: {
  action: NonNullable<
    string | ((formData: FormData) => void | Promise<void>) | undefined
  >;
  children: React.ReactNode;
  defaultEmail?: string;
  error?: string | null;
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <Form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label className="font-normal text-muted-foreground" htmlFor="email">
          邮箱
        </Label>
        <Input
          autoComplete="email"
          autoFocus
          defaultValue={defaultEmail}
          id="email"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label className="font-normal text-muted-foreground" htmlFor="password">
          密码
        </Label>
        <div className="relative">
          <Input
            className="pr-10"
            id="password"
            name="password"
            placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
            required
            type={showPassword ? "text" : "password"}
          />
          <button
            aria-label={showPassword ? "隐藏密码" : "显示密码"}
            aria-pressed={showPassword}
            className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
            onClick={() => setShowPassword((v) => !v)}
            type="button"
          >
            {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
          </button>
        </div>
      </div>

      {error && (
        <p
          aria-live="assertive"
          className="text-[13px] leading-relaxed text-red-500"
          role="alert"
        >
          {error}
        </p>
      )}

      {children}
    </Form>
  );
}
