"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Download,
  FolderTree,
  Home,
  LayoutGrid,
  LayoutList,
  Loader2,
  Megaphone,
  Plus,
  ShieldCheck,
  Sparkles,
  UserCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Ticket } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  TicketCard,
  TicketCategoryProvider,
  TicketGroupHeader,
  useTickets,
  type TicketScope,
  type TicketStatus,
} from "./ticket-shared";
import {
  publishTicketAction,
  useUnpublishedTickets,
} from "./ticket-shared";
import { TicketFormDialog } from "./ticket-form-dialog";
import { TicketGroupManagerDialog } from "./ticket-group-manager-dialog";
import {
  TicketBatchBar,
  exportTicketsCSV,
} from "./ticket-batch-bar";
import { TicketDetailDrawer } from "./ticket-detail-drawer";
import { TicketKanban } from "./ticket-kanban";

type StatusFilter = "all" | "pending" | "in_progress" | "completed" | "closed";
type PriorityFilter = "all" | "low" | "medium" | "high" | "urgent";
type ViewMode = "list" | "kanban";
type VisibilityFilter = "all" | "public" | "private";

export function TicketManager() {
  // 🆕 产品优化：Tab 切换 —— 我的发布 / 审核队列 / 全部信息
  const [scope, setScope] = useState<TicketScope>("all");
  const {
    tickets,
    categories,
    loading,
    refresh,
    adminGroups,
    stats,
    ctxValue,
    setCategories,
  } = useTickets(scope);

  // 🆕 已启动但未发布的工单（管理员通知横幅）
  const { unpublishedTickets, mutateUnpublished } = useUnpublishedTickets(true);

  // 🆕 监听审核操作完成事件，自动刷新数据
  useEffect(() => {
    const handler = () => refresh();
    window.addEventListener("ticket-updated", handler);
    return () => window.removeEventListener("ticket-updated", handler);
  }, [refresh]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Ticket | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);

  // 优化项：状态 & 优先级筛选
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");
  // 优化项：视图切换（列表 / 看板）
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // 优化项：批量选择
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 优化项：详情抽屉
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const openCreate = () => {
    setEditingTicket(null);
    setDialogOpen(true);
  };

  const openEdit = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setDialogOpen(true);
  };

  const openDetail = (ticket: Ticket) => {
    setDetailTicket(ticket);
    setDetailOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await fetch(`/api/tickets?id=${deleteConfirm.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("信息已删除");
      setDeleteConfirm(null);
      refresh();
    } catch {
      toast.error("删除失败，请重试");
    }
  };

  // 🆕 发布工单到市场：将已启动但未发布的工单发布到「发现市场」
  const handlePublish = async (ticket: Ticket) => {
    try {
      await publishTicketAction(ticket.id);
      toast.success(`「${ticket.title}」已发布到发现市场`);
      refresh();
      mutateUnpublished();
      window.dispatchEvent(new Event("ticket-updated"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "发布失败，请重试",
      );
    }
  };

  // 看板视图状态变更（拖拽）
  const handleKanbanStatusChange = async (
    ticket: Ticket,
    newStatus: TicketStatus
  ) => {
    const res = await fetch("/api/tickets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: ticket.id,
        title: ticket.title,
        description: ticket.description,
        content: ticket.content,
        priority: ticket.priority,
        status: newStatus,
        progress: ticket.progress,
        assignee: ticket.assignee,
        dueDate: ticket.dueDate ? ticket.dueDate.toISOString() : null,
        categoryId: ticket.categoryId,
        isActive: ticket.isActive,
        sortOrder: ticket.sortOrder,
        visibility: ticket.visibility,
      }),
    });
    if (!res.ok) throw new Error("Failed to update status");
    refresh();
  };

  // 批量选择切换
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleExport = (ids: string[]) => {
    const toExport =
      ids.length > 0
        ? tickets.filter((t) => ids.includes(t.id))
        : tickets;
    if (toExport.length === 0) {
      toast.error("没有可导出的信息");
      return;
    }
    exportTicketsCSV(toExport);
    toast.success(`已导出 ${toExport.length} 条信息`);
  };

  // 应用筛选条件
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (visibilityFilter !== "all" && t.visibility !== visibilityFilter) return false; 
      return true;
    });
  }, [tickets, statusFilter, priorityFilter, visibilityFilter]); // 依赖项增加 visibilityFilter

  const filteredGroups = useMemo(() => {
    const groups = adminGroups.groups
      .map(({ group, tickets: groupTickets }) => ({
        group,
        tickets: groupTickets.filter((t) => filteredTickets.includes(t)),
      }))
      .filter((g) => g.tickets.length > 0);

    const ungrouped = adminGroups.ungrouped.filter((t) =>
      filteredTickets.includes(t)
    );

    return { groups, ungrouped };
  }, [adminGroups, filteredTickets]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="dot-pulse h-2 w-2 rounded-full bg-primary" />
          加载中...
        </div>
      </div>
    );
  }

  const hasFilters = statusFilter !== "all" || priorityFilter !== "all" || visibilityFilter !== "all";
  const selectedIdArray = Array.from(selectedIds);

  return (
    <TicketCategoryProvider value={ctxValue}>
      <div className="page-container">
        {/* 顶部操作栏 */}
        <div className="mb-6 flex flex-wrap items-center justify-end gap-2 sm:mb-10">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild className="gap-1.5" size="sm" variant="ghost">
              <Link href="/">
                <Home className="size-3.5" />
                <span className="hidden sm:inline">返回主页</span>
              </Link>
            </Button>
            <Button
              className="gap-1.5"
              onClick={() => setGroupDialogOpen(true)}
              size="sm"
              variant="ghost"
            >
              <FolderTree className="size-3.5" />
              <span className="hidden sm:inline">管理分类</span>
            </Button>
            <Button
              className="gap-1.5"
              onClick={() => handleExport([])}
              size="sm"
              variant="ghost"
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">导出全部</span>
            </Button>
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="size-4" />
              新建发布
            </Button>
          </div>
        </div>

        {/* 🆕 产品优化：Tab 切换 —— 我的发布 / 审核队列 / 全部信息 */}
        <div className="mb-6 flex items-center gap-1 rounded-xl border bg-muted/30 p-1">
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              scope === "mine"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setScope("mine")}
            type="button"
          >
            <UserCircle className="size-3.5" />
            我的发布
          </button>
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              scope === "review"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setScope("review")}
            type="button"
          >
            <ShieldCheck className="size-3.5" />
            审核队列
          </button>
          <button
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              scope === "all"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setScope("all")}
            type="button"
          >
            <LayoutList className="size-3.5" />
            全部信息
          </button>
        </div>

        {/* 🆕 管理员通知横幅：已启动但未发布的工单，提醒审核发布 */}
        {unpublishedTickets.length > 0 && (
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 px-4 py-3">
            <Megaphone className="size-5 shrink-0 text-orange-600 dark:text-orange-400" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                有 {unpublishedTickets.length} 条工单已启动但未发布到市场
              </p>
              <p className="mt-0.5 text-xs text-orange-600/80 dark:text-orange-400/80">
                普通用户或 AI 创建的工单需审核发布后，其他用户才能在「发现市场」看到
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setScope("review")}
                size="sm"
                variant="outline"
              >
                <ShieldCheck className="size-3.5" />
                前往审核
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await Promise.all(
                      unpublishedTickets.map((t) => publishTicketAction(t.id)),
                    );
                    toast.success(
                      `已批量发布 ${unpublishedTickets.length} 条工单到市场`,
                    );
                    refresh();
                    mutateUnpublished();
                    window.dispatchEvent(new Event("ticket-updated"));
                  } catch (err) {
                    toast.error(
                      err instanceof Error ? err.message : "批量发布失败",
                    );
                  }
                }}
                size="sm"
              >
                <Megaphone className="size-3.5" />
                一键全部发布
              </Button>
            </div>
          </div>
        )}

        {/* 统计看板 —— 信息系统优化项 */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <StatCard
            className="text-blue-600 dark:text-blue-400"
            icon={<ClipboardList className="size-4" />}
            label="全部"
            value={stats.total}
          />
          <StatCard
            className="text-slate-600 dark:text-slate-300"
            icon={<Loader2 className="size-4" />}
            label={STATUS_LABELS.pending}
            value={stats.pending}
          />
          <StatCard
            className="text-amber-600 dark:text-amber-400"
            icon={<Loader2 className="size-4" />}
            label="进行中"
            value={stats.inProgress}
          />
          <StatCard
            className="text-emerald-600 dark:text-emerald-400"
            icon={<CheckCircle2 className="size-4" />}
            label="已完成"
            value={stats.completed}
          />
          <StatCard
            className="text-zinc-600 dark:text-zinc-400"
            icon={<CheckCircle2 className="size-4" />}
            label="已关闭"
            value={stats.closed}
          />
          <StatCard
            className="text-red-600 dark:text-red-400"
            icon={<AlertTriangle className="size-4" />}
            label="逾期"
            value={stats.overdue}
          />
          <StatCard
            className="text-red-600 dark:text-red-400"
            icon={<AlertTriangle className="size-4" />}
            label="紧急"
            value={stats.urgent}
          />
        </div>

        {/* 筛选栏 + 视图切换 —— 信息系统优化项 */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-muted-foreground">
            筛选：
          </span>
                    {/* 新增：可见性筛选 */}
          <Select
            onValueChange={(v) => setVisibilityFilter(v as VisibilityFilter)}
            value={visibilityFilter}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="发布状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">发布状态</SelectItem>
              <SelectItem value="public">发布</SelectItem>
              <SelectItem value="private">私有</SelectItem>
            </SelectContent>
          </Select>
          <Select
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            value={statusFilter}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">匹配状态</SelectItem>
              <SelectItem value="pending">{STATUS_LABELS.pending}</SelectItem>
              <SelectItem value="in_progress">
                {STATUS_LABELS.in_progress}
              </SelectItem>
              <SelectItem value="completed">
                {STATUS_LABELS.completed}
              </SelectItem>
              <SelectItem value="closed">{STATUS_LABELS.closed}</SelectItem>
            </SelectContent>
          </Select>
          <Select
            onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}
            value={priorityFilter}
          >
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="优先级" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">优先级</SelectItem>
              <SelectItem value="low">{PRIORITY_LABELS.low}</SelectItem>
              <SelectItem value="medium">{PRIORITY_LABELS.medium}</SelectItem>
              <SelectItem value="high">{PRIORITY_LABELS.high}</SelectItem>
              <SelectItem value="urgent">{PRIORITY_LABELS.urgent}</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              onClick={() => {
                setStatusFilter("all");
                setPriorityFilter("all");
                setVisibilityFilter("all");
              }}
              size="sm"
              variant="ghost"
            >
              清除筛选
            </Button>
          )}

          {/* 视图切换 */}
          <div className="ml-auto flex items-center gap-1 rounded-lg border bg-muted/30 p-0.5">
            <button
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "list"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewMode("list")}
              type="button"
            >
              <LayoutList className="size-3.5" />
              列表
            </button>
            <button
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                viewMode === "kanban"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewMode("kanban")}
              type="button"
            >
              <LayoutGrid className="size-3.5" />
              看板
            </button>
          </div>
        </div>

        {/* 批量操作栏 */}
        {viewMode === "list" && (
          <TicketBatchBar
            onClear={clearSelection}
            onExport={handleExport}
            onRefresh={refresh}
            selectedIds={selectedIdArray}
            total={tickets.length}
          />
        )}

        {/* 空状态 */}
        {tickets.length === 0 && (
          <div className="empty-state">
            <Plus className="mb-4 size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">还没有任何信息</p>
            <Button
              className="mt-4 gap-2"
              onClick={openCreate}
              variant="outline"
            >
              <Plus className="size-4" />
              创建第一条信息
            </Button>
          </div>
        )}

        {/* 筛选无结果 */}
        {tickets.length > 0 && filteredTickets.length === 0 && (
          <div className="empty-state">
            <ClipboardList className="mb-4 size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              没有符合筛选条件的信息
            </p>
          </div>
        )}

        {/* 看板视图 */}
        {viewMode === "kanban" && filteredTickets.length > 0 && (
          <TicketKanban
            categories={categories}
            onEdit={openEdit}
            onStatusChange={handleKanbanStatusChange}
            onTicketClick={openDetail}
            tickets={filteredTickets}
          />
        )}

        {/* 列表视图 */}
        {viewMode === "list" && filteredTickets.length > 0 && (
          <>
            {filteredGroups.groups.map(({ group, tickets: groupTickets }) => (
              <section className="mb-10" key={group.key}>
                <TicketGroupHeader count={groupTickets.length} group={group} />
                <div className="card-grid">
                  {groupTickets.map((ticket) => (
                    <div key={ticket.id} className="cursor-pointer relative">
                      {/* 批量选择复选框 */}
                      <button
                        className="absolute left-2 top-2 z-10 rounded border-border bg-background/80 p-0.5 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(ticket.id);
                        }}
                        type="button"
                      >
                        {selectedIds.has(ticket.id) ? (
                          <CheckCircle2 className="size-4 text-primary" />
                        ) : (
                          <div className="size-4 rounded-full border-2 border-muted-foreground/30" />
                        )}
                      </button>
                      <div
                        className={cn(
                          selectedIds.has(ticket.id) && "ring-2 ring-primary ring-offset-2"
                        )}
                        onClick={() => openDetail(ticket)}
                      >
                        <TicketCard
                          admin
                          onDelete={(t) => setDeleteConfirm(t)}
                          onEdit={openEdit}
                          onPublish={handlePublish}
                          ticket={ticket}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {filteredGroups.ungrouped.length > 0 && (
              <section className="mb-10">
                <TicketGroupHeader
                  count={filteredGroups.ungrouped.length}
                  group={{ bg: "bg-slate-400", label: "其他" }}
                />
                <div className="card-grid">
                  {filteredGroups.ungrouped.map((ticket) => (
                    <div key={ticket.id} className="cursor-pointer relative">
                      <button
                        className="absolute left-2 top-2 z-10 rounded border-border bg-background/80 p-0.5 opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(ticket.id);
                        }}
                        type="button"
                      >
                        {selectedIds.has(ticket.id) ? (
                          <CheckCircle2 className="size-4 text-primary" />
                        ) : (
                          <div className="size-4 rounded-full border-2 border-muted-foreground/30" />
                        )}
                      </button>
                      <div
                        className={cn(
                          selectedIds.has(ticket.id) && "ring-2 ring-primary ring-offset-2"
                        )}
                        onClick={() => openDetail(ticket)}
                      >
                        <TicketCard
                          admin
                          onDelete={(t) => setDeleteConfirm(t)}
                          onEdit={openEdit}
                          onPublish={handlePublish}
                          ticket={ticket}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* 表单弹窗 */}
        <TicketFormDialog
          categories={categories}
          editingTicket={editingTicket}
          isAdmin={true}
          onOpenChange={setDialogOpen}
          onOpenGroupDialog={() => setGroupDialogOpen(true)}
          onSuccess={refresh}
          open={dialogOpen}
        />

        {/* 详情抽屉 —— 产品优化核心 */}
        <TicketDetailDrawer
          categories={categories}
          onDelete={(t) => {
            setDetailOpen(false);
            setDeleteConfirm(t);
          }}
          onEdit={(t) => {
            setDetailOpen(false);
            openEdit(t);
          }}
          onOpenChange={setDetailOpen}
          onPublish={handlePublish}
          onRefresh={refresh}
          open={detailOpen}
          ticket={detailTicket}
        />

        {/* 删除确认 */}
        <Dialog
          onOpenChange={(open) => !open && setDeleteConfirm(null)}
          open={!!deleteConfirm}
        >
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
              <DialogDescription>
                确定要删除信息「{deleteConfirm?.title}」吗？此操作不可撤销。
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setDeleteConfirm(null)} variant="outline">
                取消
              </Button>
              <Button onClick={handleDelete} variant="destructive">
                删除
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 分类管理弹窗 */}
        <TicketGroupManagerDialog
          onGroupsChange={async () => {
            try {
              const res = await fetch("/api/ticket-categories");
              if (res.ok) {
                const latestCategories = await res.json();
                if (setCategories) setCategories(latestCategories);
                refresh();
              }
            } catch (error) {
              console.error("刷新信息分类列表失败", error);
            }
          }}
          onOpenChange={setGroupDialogOpen}
          open={groupDialogOpen}
        />
      </div>
    </TicketCategoryProvider>
  );
}

/* ================================================================
 * StatCard —— 统计看板小卡片
 * ================================================================ */
function StatCard({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-card/50 px-3 py-2.5">
      <div className={className}>{icon}</div>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-none">{value}</div>
        <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {label}
        </div>
      </div>
    </div>
  );
}
