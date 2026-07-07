"use client";

import { motion } from "motion/react";
import Image from "next/image";
import { useState } from "react";

const SUGGESTED_PROMPTS = [
  {
    icon: "💡",
    title: "解释概念",
    prompt: "用通俗易懂的语言解释什么是 React Server Components",
  },
  {
    icon: "✍️",
    title: "撰写文案",
    prompt: "帮我写一封正式的商务邮件，主题是项目进度汇报",
  },
  {
    icon: "🔧",
    title: "编写代码",
    prompt: "用 TypeScript 实现一个防抖函数，并添加类型注解",
  },
  {
    icon: "📊",
    title: "分析问题",
    prompt: "对比 REST API 和 GraphQL 的优缺点",
  },
];

export const Greeting = ({
  onSelectPrompt,
}: {
  onSelectPrompt?: (prompt: string) => void;
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <div className="flex w-full flex-col items-center px-4" key="overview">
      {/* Logo 区域：增大尺寸，增加光晕效果 */}
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="relative mb-6 flex size-16 items-center justify-center overflow-hidden rounded-2xl ring-1 ring-primary/20 shadow-lg shadow-primary/5"
        initial={{ opacity: 0, scale: 0.8 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <Image
          alt="OPC Bot"
          className="size-full object-cover"
          height={64}
          src="/logo.jpg"
          width={64}
        />
      </motion.div>

      {/* 主标题：保持大字号，加粗 */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        有什么我可以帮你的？
      </motion.div>

      {/* 副标题：增大字号，提升可读性 */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 text-center text-muted-foreground text-base md:text-lg"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.45, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        提出问题、编写代码或探索想法。
      </motion.div>

      {/* 示例提示词：卡片式布局 */}
      {onSelectPrompt && (
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2"
          initial={{ opacity: 0, y: 10 }}
          transition={{ delay: 0.6, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {SUGGESTED_PROMPTS.map((suggestion, index) => (
            <button
              aria-label={`使用示例：${suggestion.title}`}
              key={suggestion.title}
              onClick={() => onSelectPrompt(suggestion.prompt)}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              type="button"
              className="group flex flex-col items-start gap-2 rounded-xl border border-border/60 bg-card/40 p-4 text-left transition-all duration-200 hover:border-primary/40 hover:bg-accent hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              <span className="flex items-center gap-2 text-base font-medium text-foreground">
                <span className="text-xl" aria-hidden="true">
                  {suggestion.icon}
                </span>
                {suggestion.title}
              </span>
              <span
                className={`line-clamp-1 text-sm text-muted-foreground transition-colors ${
                  hoveredIndex === index ? "text-foreground/70" : ""
                }`}
              >
                {suggestion.prompt}
              </span>
            </button>
          ))}
        </motion.div>
      )}
    </div>
  );
};
