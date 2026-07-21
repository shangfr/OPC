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
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="lazyOnload"
      />
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
    <SidebarProvider defaultOpen={!isCollapsed}>
      <HeaderActionsProvider>
        <ChatProvider>
          <AppSidebar isAdmin={isAdminUser} user={session?.user as any} />
          <SidebarInset>
            <GlobalHeader />
            <Toaster
              position="top-center"
              theme="system"
              toastOptions={{
                className:
                  "!bg-card !text-foreground !border-border/50 !shadow-lg",
              }}
            />
            <Suspense fallback={<div className="flex h-dvh" />}>
              <ChatShellWrapper />
            </Suspense>
            {children}
          </SidebarInset>
        </ChatProvider>
      </HeaderActionsProvider>
    </SidebarProvider>
  );
}
