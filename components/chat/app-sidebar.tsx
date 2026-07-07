"use client";
import {
  BarChart3,
  BookOpen,
  Bot,
  ClipboardList,
  CreditCard,
  DollarSign,
  FileCheck,
  FileText,
  MessagesSquareIcon,
  PanelLeftIcon,
  PenSquareIcon,
  Pin,
  Receipt,
  ShoppingCart,
  TrashIcon,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { User } from "next-auth";
import { useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { unstable_serialize } from "swr/infinite";
import { getChatHistoryPaginationKey, SidebarHistory } from "@/components/chat/sidebar-history";
import { SidebarUserNav } from "@/components/chat/sidebar-user-nav";
import { TeamSwitcher } from "@/components/chat/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { useActiveChat } from "@/hooks/use-active-chat";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

// 扩展 User 类型以包含 SaaS 多租户字段（与 auth.ts 中的 Session 声明一致）
type SidebarUser = User & {
  type?: "guest" | "regular";
  accountType?: "personal" | "enterprise";
  teamRole?: "owner" | "admin" | "member" | null;
};

export function AppSidebar({ user, isAdmin, isEnterpriseAdmin = false }: { user: SidebarUser | undefined; isAdmin: boolean; isEnterpriseAdmin?: boolean; }) {
  const router = useRouter();
  const pathname = usePathname();
  const { agentId, messages } = useActiveChat();
  const isEmptyChat = messages.length === 0;
  const { setOpenMobile, toggleSidebar } = useSidebar();
  const { mutate } = useSWRConfig();
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);

  const handleDeleteAll = () => {
    setShowDeleteAllDialog(false);
    router.replace("/");
    mutate(unstable_serialize(getChatHistoryPaginationKey), [], { revalidate: false, });
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history`, { method: "DELETE", });
    toast.success("全部对话已删除");
  };

  return (
    <>
      <Sidebar className="border-sidebar-border shadow-[var(--shadow-sidebar)]" collapsible="icon" variant="inset" >
        {/* ===== Logo / Brand 区域 ===== */}
        <SidebarHeader className="border-sidebar-border px-3 pb-3 pt-4">
          <SidebarMenu>
            <SidebarMenuItem className="flex items-center justify-between">
              <div className="group/logo relative flex items-center gap-2.5">
                {/* 折叠时的 Logo 图标 */}
                <SidebarMenuButton asChild className="size-8 shrink-0 items-center justify-center rounded-lg !p-0 group-data-[collapsible=icon]:group-hover/logo:opacity-0 transition-opacity duration-150" tooltip="OPC Bot" >
                  <Link href="/" onClick={() => setOpenMobile(false)}>
                    <img alt="OPC Bot" className="size-8 rounded-lg object-cover" src="/logo.jpg" />
                  </Link>
                </SidebarMenuButton>

                {/* 展开时的品牌名称 */}
                <div className="flex items-center gap-1.5 group-data-[collapsible=icon]:hidden">
                  <span className="text-base font-semibold tracking-tight text-sidebar-foreground"> OPC Bot </span>
                </div>

                {/* 折叠时悬停出现的展开按钮 */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <SidebarMenuButton className="pointer-events-none absolute inset-0 size-8 opacity-0 group-data-[collapsible=icon]:pointer-events-auto group-data-[collapsible=icon]:group-hover/logo:opacity-100" onClick={() => toggleSidebar()} >
                      <PanelLeftIcon className="size-5" />
                    </SidebarMenuButton>
                  </TooltipTrigger>
                  <TooltipContent className="hidden md:block" side="right"> 展开侧边栏 </TooltipContent>
                </Tooltip>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>

          {/* SaaS 多租户：团队切换器 — 仅企业账号显示（个人账号/访客无团队功能） */}
          {user && user.type !== "guest" && user.accountType === "enterprise" && (
            <div className="group-data-[collapsible=icon]:hidden">
              <TeamSwitcher />
            </div>
          )}
        </SidebarHeader>

        <SidebarContent>
          {/* ===== 工作台 ===== */}
          <SidebarGroup className="px-2 pt-3">
            <SidebarGroupLabel className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/40">
              工作台
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* 新建对话 */}
                <SidebarMenuItem>
                  <SidebarMenuButton 
                    className="h-10 w-full gap-2.5 rounded-lg border border-sidebar-border bg-sidebar-accent/40 text-[15px] font-medium text-sidebar-foreground transition-all duration-150 hover:bg-sidebar-primary/15 hover:text-sidebar-primary hover:border-sidebar-primary/30 disabled:opacity-40 disabled:pointer-events-none" 
                    disabled={isEmptyChat} 
                    onClick={async () => {
                      setOpenMobile(false);
                      try {
                        const res = await fetch("/api/chat/create", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ agentId: agentId ?? undefined, }),
                        });
                        if (!res.ok) { throw new Error("Failed to create chat"); }
                        const { chatId } = await res.json();
                        // Store agentId temporarily for page initialization
                        if (agentId) { sessionStorage.setItem( `pending-chat-${chatId}`, agentId ); }
                        router.push(`/chat/${chatId}`);
                      } catch {
                        toast.error("创建对话失败，请重试");
                      }
                    }} 
                    tooltip="新建对话"
                  >
                    <PenSquareIcon className="size-5" />
                    <span>新建对话</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* ===== 导航 ===== */}
          <SidebarGroup className="px-2 pt-1">
            <SidebarGroupLabel className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/40">
              导航
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {/* 智库 */}
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/explore"} className="h-9 gap-2.5 rounded-lg text-[15px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium" tooltip="智库" >
                      <Link href="/explore" onClick={() => setOpenMobile(false)} title="OPC智库咨询台">
                        <Bot className="size-5" />
                        <span>智库</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {/* 智客 */}
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname?.startsWith("/tickets")} className="h-9 gap-2.5 rounded-lg text-[15px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium" tooltip="智客" >
                      <Link href="/tickets" onClick={() => setOpenMobile(false)} title="AI资源整合引擎">
                        <ClipboardList className="size-5" />
                        <span>智客</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {/* 智汇 */}
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/pinned"} className="h-9 gap-2.5 rounded-lg text-[15px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium" tooltip="智汇" >
                      <Link href="/pinned" onClick={() => setOpenMobile(false)} title="信息汇聚中枢">
                        <Pin className="size-5" />
                        <span>智汇</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}

                {/* 智品 */}
                {user && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/artifacts"} className="h-9 gap-2.5 rounded-lg text-[15px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium" tooltip="智品" >
                      <Link href="/artifacts" onClick={() => setOpenMobile(false)} title="AI交付物品库">
                        <FileText className="size-5" />
                        <span>智品</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* ===== 工作台（按账号类型显示不同入口） ===== */}
          {user && user.type !== "guest" && (
            <SidebarGroup className="px-2 pt-1">
              <SidebarGroupLabel className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/40">
                工作台
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* 知识库 — 所有正式用户可用 */}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname?.startsWith("/knowledge")} className="h-9 gap-2.5 rounded-lg text-[15px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium" tooltip="知识库" >
                      <Link href="/knowledge" onClick={() => setOpenMobile(false)}>
                        <BookOpen className="size-5" />
                        <span>知识库</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* 创作者中心 — 个人账号 + 企业管理员 */}
                  {(user.accountType === "personal" || isEnterpriseAdmin) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/creator"} className="h-9 gap-2.5 rounded-lg text-[15px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium" tooltip={isEnterpriseAdmin ? "团队OPC管理" : "创作者中心"} >
                        <Link href="/creator" onClick={() => setOpenMobile(false)}>
                          <DollarSign className="size-5" />
                          <span>{isEnterpriseAdmin ? "团队OPC管理" : "创作者中心"}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {/* 交易市场 — 所有用户可浏览 */}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/marketplace"} className="h-9 gap-2.5 rounded-lg text-[15px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium" tooltip="交易市场" >
                      <Link href="/marketplace" onClick={() => setOpenMobile(false)}>
                        <ShoppingCart className="size-5" />
                        <span>交易市场</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* 团队设置 — 仅企业账号（个人账号无团队功能，可升级企业账号获得） */}
                  {user.accountType === "enterprise" && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/team"} className="h-9 gap-2.5 rounded-lg text-[15px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium" tooltip="团队设置" >
                        <Link href="/team" onClick={() => setOpenMobile(false)}>
                          <Users className="size-5" />
                          <span>团队设置</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {/* 升级企业 — 仅个人账号（升级后获得团队功能并成为企业管理员） */}
                  {user.accountType === "personal" && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={pathname === "/register-enterprise"} className="h-9 gap-2.5 rounded-lg text-[15px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium" tooltip="升级企业账号" >
                        <Link href="/register-enterprise" onClick={() => setOpenMobile(false)}>
                          <Users className="size-5" />
                          <span>升级企业账号</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}

                  {/* 订阅管理 — 所有正式用户 */}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/settings"} className="h-9 gap-2.5 rounded-lg text-[15px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium" tooltip="订阅管理" >
                      <Link href="/settings" onClick={() => setOpenMobile(false)}>
                        <CreditCard className="size-5" />
                        <span>订阅管理</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* ===== 管理（平台管理员或企业团队管理员可见） ===== */}
          {user && (isAdmin || isEnterpriseAdmin) && (
            <SidebarGroup className="px-2 pt-1">
              <SidebarGroupLabel className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/40">
                {isEnterpriseAdmin && !isAdmin ? "团队管理" : "管理"}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {/* 管理后台首页 — 仅平台管理员 */}
                  {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname === "/admin"} className="h-9 gap-2.5 rounded-lg text-[15px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium" tooltip="管理后台" >
                      <Link href="/admin" onClick={() => setOpenMobile(false)}>
                        <PanelLeftIcon className="size-5" />
                        <span>管理后台</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  )}

                  {/* 上架审核 — 仅平台管理员 */}
                  {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname?.startsWith("/admin/applications")} className="h-9 gap-2.5 rounded-lg text-[15px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium" tooltip="上架审核" >
                      <Link href="/admin/applications" onClick={() => setOpenMobile(false)}>
                        <FileCheck className="size-5" />
                        <span>上架审核</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  )}

                  {/* OPC 管理 — 平台管理员 + 企业团队管理员 */}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname?.startsWith("/admin/opcs")} className="h-9 gap-2.5 rounded-lg text-[15px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium" tooltip="OPC 管理" >
                      <Link href="/admin/opcs" onClick={() => setOpenMobile(false)}>
                        <Bot className="size-5" />
                        <span>OPC 管理</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>

                  {/* 订单流水 — 仅平台管理员 */}
                  {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname?.startsWith("/admin/orders")} className="h-9 gap-2.5 rounded-lg text-[15px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium" tooltip="订单流水" >
                      <Link href="/admin/orders" onClick={() => setOpenMobile(false)}>
                        <Receipt className="size-5" />
                        <span>订单流水</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  )}

                  {/* 数据看板 — 仅平台管理员 */}
                  {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname?.startsWith("/admin/stats")} className="h-9 gap-2.5 rounded-lg text-[15px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium" tooltip="数据看板" >
                      <Link href="/admin/stats" onClick={() => setOpenMobile(false)}>
                        <BarChart3 className="size-5" />
                        <span>数据看板</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  )}

                  {/* 用户管理 — 平台管理员 + 企业团队管理员 */}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={pathname?.startsWith("/admin/users")} className="h-9 gap-2.5 rounded-lg text-[15px] text-sidebar-foreground/65 transition-all duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-sidebar-accent data-[active=true]:text-sidebar-foreground data-[active=true]:font-medium" tooltip="用户管理" >
                      <Link href="/admin/users" onClick={() => setOpenMobile(false)}>
                        <Users className="size-5" />
                        <span>用户管理</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* ===== 历史对话区 ===== */}
          <SidebarGroup className="px-2 pt-1">
            <SidebarGroupLabel className="mb-1 px-2 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/40">
              <MessagesSquareIcon className="mr-1.5 size-4" /> 历史对话
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarHistory user={user} />
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* ===== 底部 ===== */}
        <SidebarFooter className="border-t border-sidebar-border px-2 pb-2 pt-2">
          <SidebarMenu>
            {user && (
              <SidebarMenuItem>
                <SidebarMenuButton 
                  className="h-9 gap-2.5 rounded-lg text-[14px] text-sidebar-foreground/35 transition-all duration-150 hover:bg-destructive/12 hover:text-destructive/80" 
                  onClick={() => setShowDeleteAllDialog(true)} 
                  tooltip="清空全部对话"
                >
                  <TrashIcon className="size-4" />
                  <span>清空全部对话</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
          {user && <SidebarUserNav user={user} />}
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <AlertDialog onOpenChange={setShowDeleteAllDialog} open={showDeleteAllDialog} >
        <AlertDialogContent className="dialog-mobile-friendly max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle>清空全部对话？</AlertDialogTitle>
            <AlertDialogDescription> 此操作无法撤销，将永久删除所有对话记录。 </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAll}> 确认清空 </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
