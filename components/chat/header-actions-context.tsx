"use client";

import { createContext, useContext, useMemo, useState } from "react";

/**
 * Header 操作按钮插槽机制
 *
 * 页面可通过 useHeaderActions().setActions(actions) 注册主操作按钮，
 * GlobalHeader 会在右侧渲染这些按钮（位于快捷键帮助左侧）。
 *
 * 用法示例（在页面组件中）：
 *   const { setActions } = useHeaderActions();
 *   useEffect(() => {
 *     setActions(<Button onClick={...}>发布新工单</Button>);
 *     return () => setActions(null);
 *   }, []);
 */

type HeaderActionsContextValue = {
  actions: React.ReactNode;
  setActions: (actions: React.ReactNode | null) => void;
};

const HeaderActionsContext = createContext<HeaderActionsContextValue | null>(
  null
);

export function HeaderActionsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [actions, setActions] = useState<React.ReactNode>(null);

  const value = useMemo<HeaderActionsContextValue>(
    () => ({ actions, setActions }),
    [actions]
  );

  return (
    <HeaderActionsContext.Provider value={value}>
      {children}
    </HeaderActionsContext.Provider>
  );
}

export function useHeaderActions(): HeaderActionsContextValue {
  const ctx = useContext(HeaderActionsContext);
  if (!ctx) {
    // 在 Provider 外使用时静默降级，避免页面崩溃
    return { actions: null, setActions: () => {} };
  }
  return ctx;
}
