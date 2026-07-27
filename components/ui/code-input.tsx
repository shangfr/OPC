"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface CodeInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
}

/**
 * 6 格验证码输入组件（参考豆包/微信）
 * - 每格独立输入，自动聚焦下一格
 * - 支持粘贴自动填充
 * - 支持退格回退
 */
export function CodeInput({
  value,
  onChange,
  length = 6,
  disabled = false,
}: CodeInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [localValues, setLocalValues] = useState<string[]>(
    Array(length).fill("")
  );

  // 同步外部 value 到本地
  useEffect(() => {
    const chars = value.split("");
    const newValues = Array(length).fill("");
    for (let i = 0; i < Math.min(chars.length, length); i++) {
      newValues[i] = chars[i];
    }
    setLocalValues(newValues);
  }, [value, length]);

  const handleChange = (index: number, char: string) => {
    // 只允许数字
    char = char.replace(/\D/g, "").slice(-1);
    if (!char && localValues[index]) {
      // 退格：清空当前格
      const newValues = [...localValues];
      newValues[index] = "";
      setLocalValues(newValues);
      onChange(newValues.join(""));
      return;
    }
    if (!char) return;

    const newValues = [...localValues];
    newValues[index] = char;
    setLocalValues(newValues);
    onChange(newValues.join(""));

    // 自动聚焦下一格
    if (index < length - 1 && char) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      if (localValues[index]) {
        // 当前格有值：清空
        e.preventDefault();
        const newValues = [...localValues];
        newValues[index] = "";
        setLocalValues(newValues);
        onChange(newValues.join(""));
      } else if (index > 0) {
        // 当前格空：回退到上一格
        e.preventDefault();
        inputs.current[index - 1]?.focus();
        const newValues = [...localValues];
        newValues[index - 1] = "";
        setLocalValues(newValues);
        onChange(newValues.join(""));
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault();
      inputs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;

    const newValues = Array(length).fill("");
    for (let i = 0; i < pasted.length; i++) {
      newValues[i] = pasted[i];
    }
    setLocalValues(newValues);
    onChange(newValues.join(""));

    // 聚焦到最后一格或下一格
    const focusIndex = Math.min(pasted.length, length - 1);
    inputs.current[focusIndex]?.focus();
  };

  return (
    <div className="flex gap-2" onPaste={handlePaste}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={localValues[i]}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          className={cn(
            "size-12 rounded-lg border bg-input/30 text-center text-lg font-medium tabular-nums transition-all outline-none",
            "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:bg-background",
            "disabled:pointer-events-none disabled:opacity-50",
            localValues[i]
              ? "border-primary/40 bg-primary/5"
              : "border-input hover:border-input/80"
          )}
        />
      ))}
    </div>
  );
}
