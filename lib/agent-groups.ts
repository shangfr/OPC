/**
 * Agent 分组配色系统
 *
 * 分组（Group）= Category 表记录，通过 categoryId 关联 Agent。
 * 配色通过 colorKey 字段映射到下方预定义的 Tailwind class 集合。
 * 管理员可在分组管理 UI 中选择配色方案。
 */

/** 分组样式属性（纯 Tailwind class，供组件使用） */
export interface AgentGroupStyle {
  bg: string;
  text: string;
  accent: string;
  soft: string;
  softText: string;
  ring: string;
  gradientFrom: string;
  borderHover: string;
  hoverShadow: string;
}

/** 完整分组信息（样式 + 标识） */
export interface AgentGroup extends AgentGroupStyle {
  key: string;
  label: string;
  order: number;
}

/* ================================================================
 * 配色预设 —— 10 种 + 1 种默认
 * Tailwind v4 JIT 要求完整 class 字符串，不可动态拼接
 * ================================================================ */

export const COLOR_THEMES: Record<string, AgentGroupStyle> = {
  indigo: {
    bg: "bg-indigo-500",
    text: "text-white",
    accent: "border-l-indigo-400",
    soft: "bg-indigo-50 dark:bg-indigo-950/40",
    softText: "text-indigo-700 dark:text-indigo-300",
    ring: "ring-indigo-500/20",
    gradientFrom: "from-indigo-500/[0.04] dark:from-indigo-500/[0.08]",
    borderHover: "hover:border-indigo-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(99,102,241,0.15)]",
  },
  amber: {
    bg: "bg-amber-500",
    text: "text-amber-950",
    accent: "border-l-amber-400",
    soft: "bg-amber-50 dark:bg-amber-950/40",
    softText: "text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500/20",
    gradientFrom: "from-amber-500/[0.04] dark:from-amber-500/[0.08]",
    borderHover: "hover:border-amber-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(245,158,11,0.15)]",
  },
  emerald: {
    bg: "bg-emerald-500",
    text: "text-white",
    accent: "border-l-emerald-400",
    soft: "bg-emerald-50 dark:bg-emerald-950/40",
    softText: "text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500/20",
    gradientFrom: "from-emerald-500/[0.04] dark:from-emerald-500/[0.08]",
    borderHover: "hover:border-emerald-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(16,185,129,0.15)]",
  },
  violet: {
    bg: "bg-violet-500",
    text: "text-white",
    accent: "border-l-violet-400",
    soft: "bg-violet-50 dark:bg-violet-950/40",
    softText: "text-violet-700 dark:text-violet-300",
    ring: "ring-violet-500/20",
    gradientFrom: "from-violet-500/[0.04] dark:from-violet-500/[0.08]",
    borderHover: "hover:border-violet-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(139,92,246,0.15)]",
  },
  sky: {
    bg: "bg-sky-500",
    text: "text-white",
    accent: "border-l-sky-400",
    soft: "bg-sky-50 dark:bg-sky-950/40",
    softText: "text-sky-700 dark:text-sky-300",
    ring: "ring-sky-500/20",
    gradientFrom: "from-sky-500/[0.04] dark:from-sky-500/[0.08]",
    borderHover: "hover:border-sky-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(14,165,233,0.15)]",
  },
  orange: {
    bg: "bg-orange-500",
    text: "text-orange-950",
    accent: "border-l-orange-400",
    soft: "bg-orange-50 dark:bg-orange-950/40",
    softText: "text-orange-700 dark:text-orange-300",
    ring: "ring-orange-500/20",
    gradientFrom: "from-orange-500/[0.04] dark:from-orange-500/[0.08]",
    borderHover: "hover:border-orange-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(249,115,22,0.15)]",
  },
  rose: {
    bg: "bg-rose-500",
    text: "text-white",
    accent: "border-l-rose-400",
    soft: "bg-rose-50 dark:bg-rose-950/40",
    softText: "text-rose-700 dark:text-rose-300",
    ring: "ring-rose-500/20",
    gradientFrom: "from-rose-500/[0.04] dark:from-rose-500/[0.08]",
    borderHover: "hover:border-rose-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(244,63,94,0.15)]",
  },
  blue: {
    bg: "bg-blue-500",
    text: "text-white",
    accent: "border-l-blue-400",
    soft: "bg-blue-50 dark:bg-blue-950/40",
    softText: "text-blue-700 dark:text-blue-300",
    ring: "ring-blue-500/20",
    gradientFrom: "from-blue-500/[0.04] dark:from-blue-500/[0.08]",
    borderHover: "hover:border-blue-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(59,130,246,0.15)]",
  },
  teal: {
    bg: "bg-teal-500",
    text: "text-white",
    accent: "border-l-teal-400",
    soft: "bg-teal-50 dark:bg-teal-950/40",
    softText: "text-teal-700 dark:text-teal-300",
    ring: "ring-teal-500/20",
    gradientFrom: "from-teal-500/[0.04] dark:from-teal-500/[0.08]",
    borderHover: "hover:border-teal-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(20,184,166,0.15)]",
  },
  pink: {
    bg: "bg-pink-500",
    text: "text-pink-950",
    accent: "border-l-pink-400",
    soft: "bg-pink-50 dark:bg-pink-950/40",
    softText: "text-pink-700 dark:text-pink-300",
    ring: "ring-pink-500/20",
    gradientFrom: "from-pink-500/[0.04] dark:from-pink-500/[0.08]",
    borderHover: "hover:border-pink-500/25",
    hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(236,72,153,0.15)]",
  },
};

/** 未分组 agent 的默认配色 */
export const DEFAULT_THEME: AgentGroupStyle = {
  bg: "bg-slate-500",
  text: "text-white",
  accent: "border-l-slate-400",
  soft: "bg-slate-50 dark:bg-slate-950/40",
  softText: "text-slate-700 dark:text-slate-300",
  ring: "ring-slate-500/20",
  gradientFrom: "from-slate-500/[0.04] dark:from-slate-500/[0.08]",
  borderHover: "hover:border-slate-500/25",
  hoverShadow: "hover:shadow-[0_4px_24px_-4px_rgba(100,116,139,0.15)]",
};

/** 所有可用的配色 key，供 UI 选择器使用 */
export const COLOR_KEYS = Object.keys(COLOR_THEMES);

/** 根据 colorKey 获取配色，未知 key 回退到 indigo */
export function getColorTheme(colorKey: string): AgentGroupStyle {
  return COLOR_THEMES[colorKey] ?? COLOR_THEMES.indigo;
}

/** 从 Category 记录构建完整 AgentGroup */
export function buildGroupFromCategory(cat: {
  id: string;
  name: string;
  colorKey: string;
  sortOrder: number;
}): AgentGroup {
  return {
    ...getColorTheme(cat.colorKey),
    key: cat.id,
    label: cat.name,
    order: cat.sortOrder,
  };
}

/** 取名字的首个汉字或大写字母作为头像文字 */
export function getAvatarChar(name: string): string {
  const hanMatch = name.match(/[\u4e00-\u9fff]/);
  if (hanMatch) return hanMatch[0];
  const upperMatch = name.match(/[A-Z]/);
  if (upperMatch) return upperMatch[0];
  return name.charAt(0).toUpperCase() || "?";
}
