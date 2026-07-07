"use client";

import {
  ClipboardList,
  Clock,
  Edit,
  Lightbulb,
  Loader2,
  Plus,
  Power,
  PowerOff,
  Search,
  Trash2,
  Globe,  Lock,
  Megaphone,
  Sparkles,
} from "lucide-react";

import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAvatarChar } from "@/lib/agent-groups";
import type { Ticket } from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";

import {
  PRIORITY_LABELS,
  PRIORITY_STYLES,
  STATUS_LABELS,
  STATUS_STYLES,
  TicketCard,
  TicketCategoryProvider,
  TicketGroupHeader,
  useTickets,
} from "./ticket-shared";
import { TicketFormDialog } from "./ticket-form-dialog";
import { TicketDetailDrawer } from "./ticket-detail-drawer";
import { TicketAIEditor } from "./ticket-ai-editor";

export function TicketCards() {
  const {
    tickets,
    categories,
    loading,
    userGroups,
    activeCount,
    searchTickets,
    ctxValue,
    refresh,
  } = useTickets();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Tab 状态：我的发布 / 服务市场
  const [activeTab, setActiveTab] = useState<"mine" | "discover">("discover");

  const { data: myTickets = [], mutate: mutateMine } = useSWR<Ticket[]>(
    "/api/tickets?scope=mine",
    fetcher
  );

  const filtered = search.trim() ? searchTickets(search) : null;

  const categoryFilters = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; count: number }>();
    for (const { group, tickets: groupTickets } of userGroups.groups) {
      if (group.key === "__ungrouped__") continue;
      seen.set(group.key, {
        id: group.key,
        name: group.label,
        count: groupTickets.length,
      });
    }
    return Array.from(seen.values());
  }, [userGroups.groups]);

  const visibleGroups = useMemo(() => {
    if (activeCategory === null) return userGroups.groups;
    return userGroups.groups.filter((g) => g.group.key === activeCategory);
  }, [userGroups.groups, activeCategory]);

  const totalActive = useMemo(
    () =>
      userGroups.groups.reduce((sum, g) => sum + g.tickets.length, 0),
    [userGroups.groups]
  );

  const [showCreate, setShowCreate] = useState(false);
  // 详情抽屉状态
  const [detailTicket, setDetailTicket] = useState<Ticket | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editingTicket, setEditingTicket] = useState<Ticket | null>(null);
  const [deleteTicket, setDeleteTicket] = useState<Ticket | null>(null);
  const [deleting, setDeleting] = useState(false);

  // 🆕 AI 智能发布对话框状态
  const [showAIEditor, setShowAIEditor] = useState(false);

  
  const openDetail = (ticket: Ticket) => {
    setDetailTicket(ticket);
    setDetailOpen(true);
  };

  const openCreate = () => {
    setEditingTicket(null);
    setShowCreate(true);
  };

  const openEdit = (ticket: Ticket) => {
    setEditingTicket(ticket);
    setShowCreate(true);
  };

  const refreshAll = useCallback(() => {
    mutateMine();
    refresh();
  }, [mutateMine, refresh]);

  const handleToggleActive = async (ticket: Ticket) => {
    try {
      const res = await fetch(`/api/tickets/toggle-active?id=${ticket.id}`, {
        method: "PATCH",
      });
      
      if (!res.ok) throw new Error("操作失败");
      toast.success(ticket.isActive ? "已停用" : "已启用");
      refreshAll();
    } catch {
      toast.error("操作失败");
    }
  };

  const handleDelete = async () => {
    if (!deleteTicket) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/tickets?id=${deleteTicket.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
      toast.success("信息已删除");
      setDeleteTicket(null);
      refreshAll();
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="dot-pulse h-2 w-2 rounded-full bg-primary" />
          加载中...
        </div>
      </div>
    );
  }

  const { inactive } = userGroups;

  return (
    <TicketCategoryProvider value={ctxValue}>
      <div className="page-container">
        {/* ═══ 页面标题 ═══ */}
        <div className="mb-6 flex items-center gap-3">
          <ClipboardList className="size-6 text-primary" />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">智客</h1>
            <p className="text-sm text-muted-foreground">
              AI 资源整合引擎 — 发布与浏览供需信息
            </p>
          </div>
        </div>

        {/* ═══ Tab 切换栏 ═══ */}
        <div className="mb-6 flex gap-4 border-b border-border/40">

          <button
            className={cn(
              "relative pb-2 text-sm font-medium transition-colors",
              activeTab === "discover"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("discover")}
            type="button"
          >
            服务市场
            {activeTab === "discover" && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
            )}
          </button>

          <button
            className={cn(
              "relative pb-2 text-sm font-medium transition-colors",
              activeTab === "mine"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("mine")}
            type="button"
          >
            我的发布
            <span className="ml-1 text-xs text-muted-foreground/50">
              {myTickets.length}
            </span>
            {activeTab === "mine" && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
            )}
          </button>

        </div>

        {/* ═══ Tab: 服务市场 ═══ */}
        {activeTab === "discover" && (
          <>
            {/* 搜索框 */}
            {activeCount > 3 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
                <input
                  className="search-input"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索信息..."
                  type="text"
                  value={search}
                />
              </div>
            )}

            {/* 分类筛选 */}
            {filtered === null && categoryFilters.length > 0 && (
              <div className="mb-6 flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <button
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all sm:px-3.5",
                    activeCategory === null
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  onClick={() => setActiveCategory(null)}
                  type="button"
                >
                  全部
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.5 text-[10px]",
                      activeCategory === null
                        ? "bg-primary-foreground/20"
                        : "bg-background/80"
                    )}
                  >
                    {totalActive}
                  </span>
                </button>
                {categoryFilters.map((cat) => (
                  <button
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all sm:px-3.5",
                      activeCategory === cat.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    type="button"
                  >
                    {cat.name}
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[10px]",
                        activeCategory === cat.id
                          ? "bg-primary-foreground/20"
                          : "bg-background/80"
                      )}
                    >
                      {cat.count}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* 空状态 */}
            {tickets.length === 0 && (
              <div className="empty-state">
                <Lightbulb className="mb-4 size-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  还没有可用的信息
                </p>
              </div>
            )}

            {/* 搜索结果 */}
            {filtered !== null && filtered.length > 0 && (
              <div className="card-grid">
                {filtered.map((ticket) => (
                  <div key={ticket.id} className="cursor-pointer" onClick={() => openDetail(ticket)}>
                  <TicketCard key={ticket.id} ticket={ticket} />
                  </div>
                ))}
              </div>
            )}

            {/* 搜索无结果 */}
            {filtered !== null && filtered.length === 0 && (
              <div className="empty-state py-16">
                <Search className="mb-3 size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  未找到匹配的信息
                </p>
              </div>
            )}

            {/* 分组展示 */}
            {filtered === null &&
              visibleGroups.map(({ group, tickets: groupTickets }) => (
                <section className="mb-10" key={group.key}>
                  <TicketGroupHeader
                    count={groupTickets.length}
                    group={group}
                  />
                  <div className="card-grid">
                    {groupTickets.map((ticket) => (
                      <div key={ticket.id} className="cursor-pointer" onClick={() => openDetail(ticket)}>
                      <TicketCard key={ticket.id} ticket={ticket} />
                  </div>
                    ))}
                  </div>
                </section>
              ))}

            {/* 该类别下无信息 */}
            {filtered === null &&
              visibleGroups.length === 0 &&
              tickets.length > 0 && (
                <div className="empty-state py-16">
                  <Lightbulb className="mb-3 size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">
                    该类别下暂无信息
                  </p>
                </div>
              )}

            {/* 已停用的信息 */}
            {filtered === null &&
              activeCategory === null &&
              inactive.length > 0 && (
                <section>
                  <TicketGroupHeader
                    count={inactive.length}
                    group={{
                      bg: "bg-muted-foreground/30",
                      label: "已停用",
                    }}
                  />
                  <div className="card-grid opacity-50">
                    {inactive.map((ticket) => {
                      const avatarChar = getAvatarChar(ticket.title);
                      return (
                        <Card
                          className="relative"
                          key={ticket.id}
                          padding="lg"
                          variant="elevated"
                        >
                          <div className="mb-3 flex items-center gap-3">
                            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-base font-bold text-muted-foreground/50">
                              {avatarChar}
                            </div>
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-semibold leading-tight">
                                {ticket.title}
                              </h3>
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                <PowerOff className="size-2.5" />
                                已停用
                              </span>
                            </div>
                          </div>
                          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {ticket.description}
                          </p>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              )}
          </>
        )}

        {/* ═══ Tab: 我的发布 ═══ */}
        {activeTab === "mine" && (
          <section>
            <div className="mb-4 flex items-center justify-end gap-2">
              {/* 🆕 AI 智能发布按钮 */}
              <button
                className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-primary/80 px-2.5 py-1.5 text-xs font-medium text-primary-foreground shadow-sm transition-all hover:shadow-md"
                onClick={() => setShowAIEditor(true)}
                type="button"
              >
                <Sparkles className="size-3.5" />
                <span className="hidden sm:inline">AI 智能发布</span>
                <span className="sm:hidden">AI 发布</span>
              </button>
              <button
                className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                onClick={openCreate}
                type="button"
              >
                <Plus className="size-3.5" />
                <span className="hidden sm:inline">手动发布</span>
                <span className="sm:hidden">创建</span>
              </button>
            </div>

            {/* 🆕 用户侧审核提醒：已启动但未发布的工单，提醒等待管理员审核 */}
            {(() => {
              const pendingReview = myTickets.filter(
                (t) =>
                  t.isActive &&
                  (t.visibility === "private" || t.reviewStatus === "pending"),
              );
              if (pendingReview.length === 0) return null;
              return (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
                  <Clock className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      有 {pendingReview.length} 条工单正在等待管理员审核发布
                    </p>
                    <p className="mt-0.5 text-xs text-amber-600/80 dark:text-amber-400/80">
                      工单启动后需管理员审核发布，其他用户才能在「服务市场」看到。请耐心等待，或联系管理员加快审核。
                    </p>
                  </div>
                </div>
              );
            })()}

            {myTickets.length === 0 ? (
              <div className="empty-state py-16">
                <Plus className="mb-3 size-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">
                  创建专属信息，跟踪任务进度与截止日期
                </p>
                <button
                  className="touch-target mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                  onClick={openCreate}
                  type="button"
                >
                  <Plus className="size-3.5" />
                  创建第一条
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {myTickets.map((ticket) => {
                  const avatarChar = getAvatarChar(ticket.title);
                  const isPublished = ticket.visibility === "public";
                  return (
                    <div
                      className={cn(
                        "group rounded-xl border p-4 transition-all",
                        ticket.visibility === "private"
                          ? "border-border/50 bg-card hover:border-border hover:shadow-sm"
                          : "border-border/30 bg-muted/20 opacity-60"
                      )}
                      key={ticket.id}
                    >
                      <div className="mb-3 flex items-start gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base font-bold text-primary">
                          {avatarChar}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-semibold">
                            {ticket.title}
                          </h3>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                STATUS_STYLES[ticket.status]
                              )}
                            >
                              {STATUS_LABELS[ticket.status]}
                            </span>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                                PRIORITY_STYLES[ticket.priority]
                              )}
                            >
                              {PRIORITY_LABELS[ticket.priority]}
                            </span>
                            {ticket.isActive ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600">
                                <Power className="size-2.5" />
                                已启用
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                <PowerOff className="size-2.5" />
                                已停用
                              </span>
                            )}
                            {/* 新增的 已发布/未发布 状态 */}
                            {ticket.visibility === "public" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-blue-600">
                                <Globe className="size-2.5" />
                                已发布
                              </span>
                            ) : ticket.reviewStatus === "pending" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                                <Clock className="size-2.5" />
                                待审核
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Lock className="size-2.5" />
                                未发布
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {ticket.description}
                      </p>
                      <div className="flex items-center gap-1.5">
                        {/* 编辑按钮 */}
                        <button 
                          className="touch-target inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/50 px-2 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50" 
                          disabled={isPublished}
                          onClick={() => openEdit(ticket)} 
                          type="button" 
                        >
                          <Edit className="size-3.5" /> 编辑
                        </button>
                        
                        {/* 启用/停用按钮 */}
                        <button 
                          // 使用动态类名：如果是激活状态，显示红色(停用)；否则显示绿色(启用)
                          className={`touch-target inline-flex items-center justify-center rounded-lg border px-2 py-1.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-50 ${
                            ticket.isActive 
                              ? "border-destructive/30 text-destructive hover:bg-destructive/5" 
                              : "border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/5"
                          }`} 
                          disabled={isPublished}
                          onClick={() => handleToggleActive(ticket)} 
                          title={ticket.isActive ? "停用" : "启用"} 
                          type="button" 
                        >
                          {ticket.isActive ? ( 
                            <PowerOff className="size-3.5" /> 
                          ) : ( 
                            <Power className="size-3.5" /> 
                          )}
                        </button>

                        
                        {/* 删除按钮 */}
                        <button 
                          className="touch-target inline-flex items-center justify-center rounded-lg border border-destructive/30 px-2 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/5 disabled:pointer-events-none disabled:opacity-50" 
                          disabled={isPublished}
                          onClick={() => setDeleteTicket(ticket)} 
                          title="删除" 
                          type="button" 
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ═══ 使用抽取出来的共享表单组件 ═══ */}
      <TicketFormDialog
        categories={categories}
        editingTicket={editingTicket}
        isAdmin={false}
        onOpenChange={setShowCreate}
        onOpenGroupDialog={() => {}}
        onSuccess={refreshAll}
        open={showCreate}
      />

      {/* 🆕 AI 智能发布对话框 */}
      <TicketAIEditor
        open={showAIEditor}
        onOpenChange={setShowAIEditor}
        onSuccess={refreshAll}
      />

      {/* 新增：详情抽屉组件 */}
      <TicketDetailDrawer 
        categories={categories}
        ticket={detailTicket}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onRefresh={refreshAll}
        // 普通用户可以不传 onEdit 和 onDelete，抽屉里就不会显示编辑和删除按钮
      />

      {/* 删除确认弹窗 */}
      <Dialog
        onOpenChange={(o) => !o && setDeleteTicket(null)}
        open={!!deleteTicket}
      >
        <DialogContent className="dialog-mobile-friendly max-w-sm">
          <DialogHeader>
            <DialogTitle>删除信息？</DialogTitle>
            <DialogDescription>
              确定要删除「{deleteTicket?.title}」吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              className="touch-target rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              onClick={() => setDeleteTicket(null)}
              type="button"
            >
              取消
            </button>
            <button
              className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-destructive px-4 py-1.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
              disabled={deleting}
              onClick={handleDelete}
              type="button"
            >
              {deleting && <Loader2 className="size-3.5 animate-spin" />}
              确认删除
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TicketCategoryProvider>
  );
}
