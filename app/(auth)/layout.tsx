import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
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
        position="top-center"
        theme="system"
        toastOptions={{
          className: "!bg-card !text-foreground !border-border/50 !shadow-lg",
        }}
      />
      {/* ===== 左侧表单区 ===== */}
      <div className="relative flex w-full flex-col overflow-hidden bg-background p-6 md:p-12 xl:w-[600px] xl:shrink-0 xl:rounded-r-2xl xl:border-r xl:border-border/40 xl:p-16">
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
          className="auth-slide-in relative z-10 flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          href="/"
        >
          <ArrowLeftIcon className="size-3.5" />
          返回首页
        </Link>

        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-10">
          <div className="flex flex-col items-center gap-2">
            {/* Logo + 光环 */}
            <div className="auth-slide-in relative mb-2">
              <div className="auth-pulse-glow absolute -inset-3 rounded-2xl bg-blue-500/8 blur-md" />
              <img
                alt="OPC Bot"
                className="relative size-14 rounded-2xl object-cover ring-1 ring-border/50"
                src="/logo.jpg"
              />
            </div>
            {children}
          </div>
        </div>
      </div>

      {/* ===== 右侧科技面板 ===== */}
      <div className="hidden flex-1 xl:flex">
        <AuthPanel />
      </div>
    </div>
  );
}
