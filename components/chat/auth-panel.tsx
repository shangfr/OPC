"use client";

import { Bot, Cpu, Sparkles, Zap } from "lucide-react";

export function AuthPanel() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#070b14]">
      {/* ===== 背景层 ===== */}

      {/* 网格纹理 */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      {/* 网格淡出遮罩 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 20%, #070b14 80%)",
        }}
      />

      {/* 浮动光球 — 蓝 */}
      <div
        className="auth-float-1 absolute -top-24 -left-24 size-[420px] rounded-full opacity-25 blur-[120px]"
        style={{
          background: "radial-gradient(circle, #3b82f6, transparent 70%)",
        }}
      />

      {/* 浮动光球 — 青 */}
      <div
        className="auth-float-2 absolute -right-20 -bottom-20 size-[340px] rounded-full opacity-20 blur-[100px]"
        style={{
          background: "radial-gradient(circle, #06b6d4, transparent 70%)",
        }}
      />

      {/* 浮动光球 — 紫 */}
      <div
        className="auth-float-3 absolute top-1/2 left-1/2 size-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15 blur-[80px]"
        style={{
          background: "radial-gradient(circle, #8b5cf6, transparent 70%)",
        }}
      />

      {/* 扫描线 */}
      <div
        className="auth-scan pointer-events-none absolute inset-x-0 h-28 opacity-[0.07]"
        style={{
          background:
            "linear-gradient(to bottom, transparent, rgba(59,130,246,0.8), transparent)",
        }}
      />

      {/* ===== 内容层 ===== */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-8">
        {/* Logo 光环 */}
        <div className="relative">
          <div className="auth-pulse-glow absolute -inset-5 rounded-3xl bg-blue-500/20 blur-xl" />
          <div className="auth-pulse-glow absolute -inset-3 rounded-2xl bg-cyan-500/10 blur-lg" />
          <div className="relative flex size-20 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-white/10">
            <img
              alt="OPC Bot"
              className="size-full object-cover"
              src="/logo.jpg"
            />
          </div>
        </div>

        {/* 品牌名 */}
        <div className="text-center">
          <h2
            className="text-3xl font-bold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #fff 0%, #94a3b8 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            OPC Bot
          </h2>
          <p className="mt-2.5 max-w-[280px] text-sm leading-relaxed text-slate-400/80">
            一人公司 AI 助手，智能驱动您的业务决策
          </p>
        </div>

        {/* 功能标签 */}
        <div className="flex flex-wrap justify-center gap-2.5">
          {[
            { icon: Cpu, label: "智能分析" },
            { icon: Bot, label: "多角色 OPC" },
            { icon: Zap, label: "实时响应" },
            { icon: Sparkles, label: "AI 创作" },
          ].map(({ icon: Icon, label }) => (
            <div
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3.5 py-1.5 text-xs text-slate-400/80 backdrop-blur-sm"
              key={label}
            >
              <Icon className="size-3 text-blue-400/60" />
              {label}
            </div>
          ))}
        </div>

        {/* 底部装饰线 */}
        <div className="mt-4 flex items-center gap-3">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-white/10" />
          <div className="size-1.5 rounded-full bg-blue-400/40" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-white/10" />
        </div>
      </div>
    </div>
  );
}
