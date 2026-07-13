import { useCallback, useEffect, useRef, useState } from "react";

export function useScrollToBottom() {
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isAtBottomRef = useRef(true);
  const isUserScrollingRef = useRef(false);

  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  const checkIfAtBottom = useCallback(() => {
    if (!containerRef.current) {
      return true;
    }
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    return scrollTop + clientHeight >= scrollHeight - 100;
  }, []);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (!containerRef.current) {
      return;
    }
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior,
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let scrollTimeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      isUserScrollingRef.current = true;
      clearTimeout(scrollTimeout);

      const atBottom = checkIfAtBottom();
      setIsAtBottom(atBottom);
      isAtBottomRef.current = atBottom;

      scrollTimeout = setTimeout(() => {
        isUserScrollingRef.current = false;
      }, 150);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", handleScroll);
      clearTimeout(scrollTimeout);
    };
  }, [checkIfAtBottom]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    // 节流：避免流式输出时每个 token 都触发 scroll + reflow
    let rafId: number | null = null;
    let lastExecTime = 0;
    const THROTTLE_MS = 80; // 80ms 节流间隔，肉眼无感知但大幅减少 reflow

    const scrollIfNeeded = () => {
      if (!isAtBottomRef.current || isUserScrollingRef.current) {
        return;
      }
      const now = performance.now();
      if (now - lastExecTime < THROTTLE_MS) {
        // 已有调度则跳过，否则安排到节流窗口结束
        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            rafId = null;
            lastExecTime = performance.now();
            container.scrollTo({
              top: container.scrollHeight,
              behavior: "instant",
            });
          });
        }
        return;
      }
      lastExecTime = now;
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "instant",
      });
    };

    // 监听子树中节点增删（新消息加入），但不监听文本内容变化（流式 token）
    // subtree:true 因为消息节点嵌套在内部 wrapper div 中，非容器直接子节点
    // characterData:false 避免流式输出时每个 token 触发回调
    const mutationObserver = new MutationObserver(scrollIfNeeded);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      characterData: false,
    });

    // ResizeObserver 只观察容器本身，不观察每个子节点
    // 子节点尺寸变化会冒泡到容器尺寸变化，无需逐个监听
    const resizeObserver = new ResizeObserver(scrollIfNeeded);
    resizeObserver.observe(container);

    return () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
      }
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, []);

  function onViewportEnter() {
    setIsAtBottom(true);
    isAtBottomRef.current = true;
  }

  function onViewportLeave() {
    setIsAtBottom(false);
    isAtBottomRef.current = false;
  }

  const reset = useCallback(() => {
    setIsAtBottom(true);
    isAtBottomRef.current = true;
    isUserScrollingRef.current = false;
  }, []);

  return {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    onViewportEnter,
    onViewportLeave,
    reset,
  };
}
