import { MotionConfig } from "motion/react";
import { cookies } from "next/headers";
import Script from "next/script";
import { Suspense } from "react";
import { Toaster } from "sonner";

import { AppSidebar } from "@/components/chat/app-sidebar";
import { ChatProvider } from "@/components/chat/chat-provider";
import { ChatShellWrapper } from "@/components/chat/chat-shell-wrapper";
import { DataStreamProvider } from "@/components/chat/data-stream-provider";
import { HeaderActionsProvider } from "@/components/chat/header-actions-context";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { isAdmin } from "@/lib/utils";
import { GlobalHeader } from "@/components/chat/global-header";
import { auth } from "../(auth)/auth";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js" strategy="lazyOnload" />
      <DataStreamProvider>
        <MotionConfig reducedMotion="user">
          <Suspense fallback={<div className="flex h-dvh bg-sidebar" />}>
            <SidebarShell>{children}</SidebarShell>
          </Suspense>
        </MotionConfig>
      </DataStreamProvider>
    </>
  );
}

async function SidebarShell({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([auth(), cookies()]);
  const isCollapsed = cookieStore.get("sidebar_state")?.value !== "true";
  const isAdminUser = isAdmin(session?.user ?? {});

  return (
    // 修复点 1: 显式设置高度为 100vh，确保 SidebarProvider 填满视口
    <SidebarProvider 
      defaultOpen={!isCollapsed} 
      style={{ height: "100vh" }}
    >
      <HeaderActionsProvider>
        <ChatProvider>
          <AppSidebar isAdmin={isAdminUser} user={session?.user as any} />
          
          {/* 修复点 2: SidebarInset 设为 flex flex-col，使其成为垂直布局容器 */}
          <SidebarInset className="flex flex-col h-full overflow-hidden">
            
            {/* Header 固定在顶部，不参与滚动 */}
            <GlobalHeader />
            
            {/* Toaster 是全局组件，不影响布局流，放在顶部即可 */}
            <Toaster
              position="top-center"
              theme="system"
              toastOptions={{
                className:
                  "!bg-card !text-foreground !border-border/50 !shadow-lg",
              }}
            />
            
            {/* 修复点 3: 内容区域包裹器 */}
            {/* flex-1: 占据剩余高度 */}
            {/* overflow-y-auto: 开启滚动 */}
            {/* min-h-0: 允许 flex 子元素收缩，这是滚动能生效的关键 */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {/* ChatShellWrapper 用于处理某些状态，保持原样 */}
              <Suspense fallback={<div className="flex h-full" />}>
                <ChatShellWrapper />
              </Suspense>
              
              {/* 这里是实际的页面内容，现在它位于可滚动的容器内 */}
              {children}
            </div>
            
          </SidebarInset>
        </ChatProvider>
      </HeaderActionsProvider>
    </SidebarProvider>
  );
}
