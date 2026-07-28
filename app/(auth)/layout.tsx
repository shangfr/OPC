import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { Toaster } from "sonner";
import { AuthPanel } from "@/components/chat/auth-panel";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-dvh w-screen bg-sidebar">
      <Toaster
        position="bottom-center"
        theme="system"
        toastOptions={{
          className: "!bg-card !text-foreground !border-border/50 !shadow-lg",
        }}
      />
      {/* ===== 左侧表单区（移动端全屏，桌面端固定宽度）===== */}
      <div className="relative flex w-full flex-col overflow-hidden bg-background p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:p-12 xl:w-[480px] xl:shrink-0 xl:rounded-r-2xl xl:border-r xl:border-border/40 xl:p-16">
        {/* 环境光效 */}
        <div
          className="auth-pulse-glow pointer-events-none absolute -top-40 -right-40 size-[500px] rounded-full opacity-[0.04]"
          style={{
            background: "radial-gradient(circle, #3b82f6, transparent 70%)",
          }}
        />
        <div
          className="auth-pulse-glow pointer-events-none absolute -bottom-48 -left-48 size-[400px] rounded-full opacity-[0.03]"
          style={{
            background: "radial-gradient(circle, #06b6d4, transparent 70%)",
          }}
        />

        {/* 返回首页 */}
        <Link
          className="auth-slide-in relative z-10 flex w-fit items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-sm text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
          href="/"
        >
          <ArrowLeftIcon className="size-3.5" />
          返回首页
        </Link>

        {/* 表单内容居中 */}
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6">
          <div className="flex flex-col gap-2">
            {/* Logo + 光环 */}
            <div className="auth-slide-in relative mb-2 self-center">
              <div className="auth-pulse-glow absolute -inset-3 rounded-2xl bg-blue-500/8 blur-md" />
              <Image
                alt="OPC Bot"
                className="relative size-14 rounded-2xl object-cover ring-1 ring-border/50"
                height={56}
                src="/logo.jpg"
                width={56}
                sizes="56px"
                priority
                unoptimized
              />
            </div>
            {children}
          </div>
        </div>
      </div>

      {/* ===== 右侧科技面板（仅桌面端）===== */}
      <div className="hidden flex-1 xl:flex">
        <AuthPanel />
      </div>
    </div>
  );
}
