"use client";

/**
 * SwipeableTabs - 可滑动切换的 Tab 组件（手势冲突安全版）
 *
 * 架构：shadcn Tabs（radix 基座，a11y + 键盘导航）+ motion pan 手势
 *
 * 手势冲突处理（参考智谱清言/Kimi 同款做法）：
 * 1. 边缘安全区：左右预留 28px，不接管手势，留给系统侧滑返回
 * 2. 横竖判断：水平位移 > 纵向位移时才判定为 Tab 滑动
 * 3. touchAction: pan-y：CSS 声明竖向滚动交给浏览器原生处理
 * 4. 最小阈值：滑动 60px 才切换 Tab，过滤误触
 * 5. 边界阻尼：到达首/末 Tab 时拖拽衰减 70%，模拟原生阻尼
 *
 * 使用方式：
 * <SwipeableTabs
 *   tabs={[
 *     { label: "聊天", content: <ChatPanel /> },
 *     { label: "OPC", content: <OpcPanel /> },
 *   ]}
 * />
 */

import { motion, AnimatePresence, type PanInfo } from "motion/react";
import { useCallback, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface SwipeableTab {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

export interface SwipeableTabsProps {
  tabs: SwipeableTab[];
  /** 默认激活的 Tab value */
  defaultValue?: string;
  /** 受控激活 value */
  value?: string;
  /** Tab 切换回调 */
  onTabChange?: (value: string) => void;
  /** 是否启用内容区手势滑动（默认 true） */
  swipeable?: boolean;
  /** 切换阈值（px，默认 60） */
  swipeThreshold?: number;
  /** 边缘安全区宽度（px，默认 28） */
  edgeSafePadding?: number;
  /** Tab 栏样式 */
  tabClassName?: string;
  /** 内容区样式 */
  contentClassName?: string;
  /** 容器样式 */
  className?: string;
}

/** 边界阻尼衰减系数 */
const DAMPING_FACTOR = 0.3;

export function SwipeableTabs({
  tabs,
  defaultValue,
  value: controlledValue,
  onTabChange,
  swipeable = true,
  swipeThreshold = 60,
  edgeSafePadding = 28,
  tabClassName,
  contentClassName,
  className,
}: SwipeableTabsProps) {
  const defaultVal = defaultValue ?? tabs[0]?.value ?? "";
  const [internalValue, setInternalValue] = useState(defaultVal);
  const activeValue = controlledValue ?? internalValue;
  const activeIndex = tabs.findIndex((t) => t.value === activeValue);

  // 拖拽偏移量（受控，用于实时跟随手指）
  const [dragX, setDragX] = useState(0);
  // 是否正在横向拖拽（用于禁用内容区过渡动画）
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const setActiveValue = useCallback(
    (val: string) => {
      if (controlledValue === undefined) {
        setInternalValue(val);
      }
      onTabChange?.(val);
    },
    [controlledValue, onTabChange],
  );

  /**
   * pan 手势处理（实时跟随）
   *
   * 冲突处理规则：
   * 1. 触点在左右边缘安全区内 → 放弃手势，交给系统侧滑返回
   * 2. 纵向位移 > 横向位移 → 放弃手势，交给浏览器竖向滚动
   * 3. 到达首/末 Tab 时 → 阻尼衰减（×0.3）
   */
  const handlePan = useCallback(
    (_event: PointerEvent, info: PanInfo) => {
      if (!swipeable) return;

      const { x, y } = info.offset;
      const pointX = info.point.x;

      // 规则 1：左右边缘安全区，不接管手势
      if (
        pointX < edgeSafePadding ||
        pointX > window.innerWidth - edgeSafePadding
      ) {
        return;
      }

      // 规则 2：纵向滚动优先（上下滑动时不触发 Tab 滑动）
      if (Math.abs(y) > Math.abs(x)) {
        return;
      }

      // 标记正在拖拽（禁用过渡动画）
      if (!isDragging) {
        setIsDragging(true);
      }

      // 规则 3：边界阻尼
      if (activeIndex === 0 && x > 0) {
        // 已在最左 Tab，向右拖拽衰减 70%
        setDragX(x * DAMPING_FACTOR);
        return;
      }
      if (activeIndex === tabs.length - 1 && x < 0) {
        // 已在最右 Tab，向左拖拽衰减 70%
        setDragX(x * DAMPING_FACTOR);
        return;
      }

      setDragX(x);
    },
    [swipeable, edgeSafePadding, isDragging, activeIndex, tabs.length],
  );

  /**
   * pan 结束处理（决定是否切换 Tab）
   */
  const handlePanEnd = useCallback(
    (_event: PointerEvent, info: PanInfo) => {
      if (!swipeable) return;

      const x = info.offset.x;
      setDragX(0);
      setIsDragging(false);

      // 右滑 → 上一个 Tab
      if (x > swipeThreshold && activeIndex > 0) {
        setActiveValue(tabs[activeIndex - 1].value);
      }
      // 左滑 → 下一个 Tab
      else if (x < -swipeThreshold && activeIndex < tabs.length - 1) {
        setActiveValue(tabs[activeIndex + 1].value);
      }
      // 未达阈值 → 自动回弹（dragX 已置 0，CSS transition 处理）
    },
    [swipeable, swipeThreshold, activeIndex, tabs, setActiveValue],
  );

  return (
    <Tabs
      value={activeValue}
      onValueChange={setActiveValue}
      className={cn("flex h-full flex-col gap-0", className)}
    >
      {/* ===== Tab 栏（shadcn TabsList variant="line"） ===== */}
      <TabsList
        variant="line"
        className={cn(
          "h-auto w-full justify-start gap-0 rounded-none border-b border-border p-0",
          tabClassName,
        )}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="flex-1 gap-1.5 whitespace-nowrap rounded-none border-b-2 border-transparent py-2.5 data-active:border-foreground data-active:bg-transparent"
            >
              {Icon && <Icon className="size-4" />}
              <span>{tab.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {/* ===== 可拖拽内容区 ===== */}
      <div
        ref={containerRef}
        className={cn("relative flex-1 overflow-hidden", contentClassName)}
      >
        <motion.div
          className="relative h-full"
          style={{ touchAction: "pan-y" }}
          drag={swipeable ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0}
          dragMomentum={false}
          onPan={handlePan}
          onPanEnd={handlePanEnd}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeValue}
              style={{
                x: dragX,
              }}
              transition={
                isDragging
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 300, damping: 30 }
              }
              className="h-full"
            >
              {tabs.map((tab) => (
                <TabsContent
                  key={tab.value}
                  value={tab.value}
                  className="h-full overflow-y-auto"
                >
                  {tab.content}
                </TabsContent>
              ))}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </Tabs>
  );
}
