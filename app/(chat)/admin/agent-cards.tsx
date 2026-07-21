"use client";

import { Edit, Lightbulb, Loader2, Plus, Power, PowerOff, Search, Trash2, Upload, RotateCcw } from "lucide-react";
import { useCallback, useMemo, useState, useEffect } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAvatarChar } from "@/lib/agent-groups";
import type { Agent } from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";
import { submitListingApplicationAction, withdrawListingApplicationAction, getMyApplicationsAction } from "@/lib/opc-market/actions";
import { useHeaderActions } from "@/components/chat/header-actions-context";
import { Button } from "@/components/ui/button";

import { AgentFormDialog } from "./agent-form-dialog";
import { AgentCard, CategoryProvider, GroupHeader, useAgents } from "./opc-shared";

// 上架状态徽标映射（用于「我的 OPC」卡片展示）
function listingStatusBadge(status: string | undefined) {
  switch (status) {
    case "listed":
      return {
        text: "已上架",
        className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        icon: <Power className="size-2.5" />,
        hint: "已公开到发现广场，所有用户可见",
      };
    case "pending":
      return {
        text: "审核中",
        className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        icon: <Loader2 className="size-2.5" />,
        hint: "上架申请已提交，等待管理员审核",
      };
    case "delisted":
      return {
        text: "已下架",
        className: "bg-destructive/10 text-destructive",
        icon: <PowerOff className="size-2.5" />,
        hint: "已被管理员强制下架，不再对全站可见",
      };
    default:
      return {
        text: "私有",
        className: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
        icon: <PowerOff className="size-2.5" />,
        hint: "仅创建者可见，未提交上架申请",
      };
  }
}

export function AgentCards({ canListOpc = true }: { canListOpc?: boolean }) {
  const { agents, categories, loading, userGroups, activeCount, searchAgents, handleStartChat, ctxValue, refresh } = useAgents();
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  
  // 新增 Tab 状态
  const [activeTab, setActiveTab] = useState<"mine" | "discover">("discover");

  const { data: myAgents = [], mutate: mutateMine } = useSWR<Agent[]>("/api/agents?scope=mine", fetcher);

  const filtered = search.trim() ? searchAgents(search) : null;

  const categoryFilters = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; count: number }>();
    for (const { group, agents: groupAgents } of userGroups.groups) {
      if (group.key === "__ungrouped__") continue;
      seen.set(group.key, { id: group.key, name: group.label, count: groupAgents.length });
    }
    return Array.from(seen.values());
  }, [userGroups.groups]);

  const visibleGroups = useMemo(() => {
    if (activeCategory === null) return userGroups.groups;
    return userGroups.groups.filter((g) => g.group.key === activeCategory);
  }, [userGroups.groups, activeCategory]);

  const totalActive = useMemo(() => userGroups.groups.reduce((sum, g) => sum + g.agents.length, 0), [userGroups.groups]);

  const [showCreate, setShowCreate] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deleteAgent, setDeleteAgent] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditingAgent(null);
    setShowCreate(true);
  };

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setShowCreate(true);
  };

  // 将「创建 OPC」按钮注册到 GlobalHeader，仅在「我的 OPC」Tab 且有创建权限时显示
  const { setActions } = useHeaderActions();
  useEffect(() => {
    if (activeTab === "mine" && canListOpc) {
      setActions(
        <Button
          key="create-opc"
          className="gap-1.5"
          onClick={openCreate}
          size="sm"
        >
          <Plus className="size-4" />
          <span className="hidden sm:inline">创建 OPC</span>
          <span className="sm:hidden">创建</span>
        </Button>
      );
    } else {
      setActions(null);
    }
    return () => setActions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, canListOpc]);

  const refreshAll = useCallback(() => {
    mutateMine();
    refresh();
  }, [mutateMine, refresh]);

  // 上架申请状态：加载当前用户的 pending 申请列表
  const [applications, setApplications] = useState<{ id: string; agentId: string; status: string; type: string }[]>([]);
  const [applying, setApplying] = useState<string | null>(null); // 正在提交上架/撤回的 agentId

  const loadApplications = useCallback(async () => {
    try {
      const result = await getMyApplicationsAction();
      setApplications(
        result
          .filter((a: any) => a.status === "pending")
          .map((a: any) => ({ id: a.id, agentId: a.agentId, status: a.status, type: a.type }))
      );
    } catch {
      // 静默忽略
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  const handleApplyListing = async (agent: Agent) => {
    setApplying(agent.id);
    try {
      const result = await submitListingApplicationAction({
        agentId: agent.id,
        type: "list",
      });
      if (result.success) {
        toast.success("上架申请已提交");
        await loadApplications();
        refreshAll();
      } else {
        toast.error(result.error || "提交失败");
      }
    } catch {
      toast.error("操作失败");
    } finally {
      setApplying(null);
    }
  };

  const handleWithdrawListing = async (agent: Agent) => {
    const app = applications.find((a) => a.agentId === agent.id);
    if (!app) return;
    setApplying(agent.id);
    try {
      const result = await withdrawListingApplicationAction({
        applicationId: app.id,
      });
      if (result.success) {
        toast.success("已撤回上架申请");
        await loadApplications();
        refreshAll();
      } else {
        toast.error(result.error || "撤回失败");
      }
    } catch {
      toast.error("操作失败");
    } finally {
      setApplying(null);
    }
  };

  const handleToggleActive = async (agent: Agent) => {
    try {
      const res = await fetch(`/api/agents?id=${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !agent.isActive }),
      });
      if (!res.ok) throw new Error("操作失败");
      toast.success(agent.isActive ? "已停用" : "已启用");
      refreshAll();
    } catch {
      toast.error("操作失败");
    }
  };

  const handleDelete = async () => {
    if (!deleteAgent) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/agents?id=${deleteAgent.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("删除失败");
      toast.success("OPC 已删除");
      setDeleteAgent(null);
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
    <CategoryProvider value={ctxValue}>
      <div className="page-container">
        
        {/* 角色权限提示横幅：按上架申请权限显示差异化说明 */}
        <div
          className={`mb-6 flex items-start gap-3 rounded-lg border p-4 ${
            canListOpc
              ? "border-emerald-500/20 bg-emerald-500/[0.04]"
              : "border-amber-500/20 bg-amber-500/[0.04]"
          }`}
        >
          <div
            className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
              canListOpc ? "bg-emerald-500/10" : "bg-amber-500/10"
            }`}
          >
            {canListOpc ? (
              <Lightbulb className="size-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Lightbulb className="size-4 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {canListOpc ? "可创建并上架 OPC" : "仅可浏览与对话"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {canListOpc
                ? "可创建专属 OPC，并将私有 OPC 申请上架到公开市场供其他用户使用。上架申请需经平台管理员审核。"
                : "企业普通成员可浏览平台 OPC 并发起对话，但无法创建 OPC 或申请上架。如需创建 OPC，请联系团队管理员调整角色。"}
            </p>
          </div>
        </div>

        {/* ═══ Tab 切换栏 ═══ */}
        <div className="mb-6 flex gap-4 border-b border-border/40">

          <button
            className={cn(
              "relative pb-2 text-sm font-medium transition-colors",
              activeTab === "discover" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("discover")}
            type="button"
          >
            发现 OPC
            {activeTab === "discover" && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
            )}
          </button>

          <button
            className={cn(
              "relative pb-2 text-sm font-medium transition-colors",
              activeTab === "mine" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setActiveTab("mine")}
            type="button"
          >
            我的 OPC
            <span className="ml-1 text-xs text-muted-foreground/50">
              {myAgents.length}
            </span>
            {activeTab === "mine" && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
            )}
          </button>
        </div>

        {/* ═══ Tab: 发现 OPC ═══ */}
        {activeTab === "discover" && (
          <>
            {/* 搜索框 */}
            {activeCount > 3 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
                <input
                  className="search-input"
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索 OPC..."
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
                      activeCategory === null ? "bg-primary-foreground/20" : "bg-background/80"
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
                        activeCategory === cat.id ? "bg-primary-foreground/20" : "bg-background/80"
                      )}
                    >
                      {cat.count}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* 空状态 */}
            {agents.length === 0 && (
              <div className="empty-state">
                <Lightbulb className="mb-4 size-12 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">还没有可用的 OPC</p>
              </div>
            )}

            {/* 搜索结果 */}
            {filtered !== null && filtered.length > 0 && (
              <div className="card-grid">
                {filtered.map((agent) => (
                  <AgentCard agent={agent} key={agent.id} onChat={handleStartChat} />
                ))}
              </div>
            )}

            {/* 搜索无结果 */}
            {filtered !== null && filtered.length === 0 && (
              <div className="empty-state py-16">
                <Search className="mb-3 size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">未找到匹配的 OPC</p>
              </div>
            )}

            {/* 分组展示 */}
            {filtered === null &&
              visibleGroups.map(({ group, agents: groupAgents }) => (
                <section className="mb-10" key={group.key}>
                  <GroupHeader count={groupAgents.length} group={group} />
                  <div className="card-grid">
                    {groupAgents.map((agent) => (
                      <AgentCard agent={agent} key={agent.id} onChat={handleStartChat} />
                    ))}
                  </div>
                </section>
              ))}

            {/* 该类别下无 OPC */}
            {filtered === null && visibleGroups.length === 0 && agents.length > 0 && (
              <div className="empty-state py-16">
                <Lightbulb className="mb-3 size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">该类别下暂无 OPC</p>
              </div>
            )}

            {/* 已停用的 OPC */}
            {filtered === null && activeCategory === null && inactive.length > 0 && (
              <section>
                <GroupHeader count={inactive.length} group={{ bg: "bg-muted-foreground/30", label: "已停用" }} />
                <div className="card-grid opacity-50">
                  {inactive.map((agent) => {
                    const avatarChar = getAvatarChar(agent.name);
                    return (
                      <Card className="relative" key={agent.id} padding="lg" variant="elevated">
                        <div className="mb-3 flex items-center gap-3">
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-base font-bold text-muted-foreground/50">
                            {avatarChar}
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-semibold leading-tight">{agent.name}</h3>
                            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                              <PowerOff className="size-2.5" />
                              已停用
                            </span>
                          </div>
                        </div>
                        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{agent.description}</p>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {/* ═══ Tab: 我的 OPC ═══ */}
        {activeTab === "mine" && (
          <section>
            {myAgents.length === 0 ? (
              <div className="empty-state py-16">
                <Plus className="mb-3 size-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">创建专属的 OPC，自定义人设和提示词</p>
                <button
                  className="touch-target mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
                  onClick={openCreate}
                  type="button"
                >
                  <Plus className="size-3.5" />
                  创建第一个
                </button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {myAgents.map((agent) => {
                  const avatarChar = getAvatarChar(agent.name);
                  const ls = (agent as any).listingStatus as string | undefined;
                  const lsMeta = listingStatusBadge(ls);
                  return (
                    <div
                      className={cn(
                        "group rounded-xl border p-4 transition-all",
                        agent.isActive
                          ? "border-border/50 bg-card hover:border-border hover:shadow-sm"
                          : "border-border/30 bg-muted/20 opacity-60"
                      )}
                      key={agent.id}
                    >
                      <div className="mb-3 flex items-start gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-base font-bold text-primary">
                          {avatarChar}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-semibold">{agent.name}</h3>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-[10px]",
                                agent.isActive ? "text-emerald-600" : "text-muted-foreground"
                              )}
                            >
                              {agent.isActive ? (
                                <>
                                  <Power className="size-2.5" />
                                  已启用
                                </>
                              ) : (
                                <>
                                  <PowerOff className="size-2.5" />
                                  已停用
                                </>
                              )}
                            </span>
                            {/* 上架状态徽标 */}
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium",
                                lsMeta.className
                              )}
                              title={lsMeta.hint}
                            >
                              {lsMeta.icon}
                              {lsMeta.text}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{agent.description}</p>
                      <div className="flex items-center gap-1.5">
                        <button
                          className="touch-target inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border/50 px-2 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                          onClick={() => handleStartChat(agent)}
                          type="button"
                        >
                          对话
                        </button>
                        <button
                          className="touch-target inline-flex items-center justify-center rounded-lg border border-border/50 px-2 py-1.5 text-xs transition-colors hover:bg-muted"
                          onClick={() => openEdit(agent)}
                          title="编辑"
                          type="button"
                        >
                          <Edit className="size-3.5" />
                        </button>
                        {/* 上架/撤回按钮 — 仅对有上架权限的用户显示 */}
                        {canListOpc && ls === "private" && !applications.find((a) => a.agentId === agent.id) && (
                          <button
                            className="touch-target inline-flex items-center justify-center rounded-lg border border-border/50 px-2 py-1.5 text-xs transition-colors hover:bg-primary/5 hover:text-primary"
                            disabled={applying === agent.id}
                            onClick={() => handleApplyListing(agent)}
                            title="申请上架"
                            type="button"
                          >
                            {applying === agent.id ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
                          </button>
                        )}
                        {canListOpc && applications.find((a) => a.agentId === agent.id) && (
                          <button
                            className="touch-target inline-flex items-center justify-center rounded-lg border border-amber-500/30 px-2 py-1.5 text-xs text-amber-600 transition-colors hover:bg-amber-500/5"
                            disabled={applying === agent.id}
                            onClick={() => handleWithdrawListing(agent)}
                            title="撤回上架申请"
                            type="button"
                          >
                            {applying === agent.id ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCcw className="size-3.5" />}
                          </button>
                        )}
                        <button
                          className="touch-target inline-flex items-center justify-center rounded-lg border border-border/50 px-2 py-1.5 text-xs transition-colors hover:bg-muted"
                          onClick={() => handleToggleActive(agent)}
                          title={agent.isActive ? "停用" : "启用"}
                          type="button"
                        >
                          {agent.isActive ? <PowerOff className="size-3.5" /> : <Power className="size-3.5" />}
                        </button>
                        <button
                          className="touch-target inline-flex items-center justify-center rounded-lg border border-destructive/30 px-2 py-1.5 text-xs text-destructive transition-colors hover:bg-destructive/5"
                          onClick={() => setDeleteAgent(agent)}
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
      <AgentFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        editingAgent={editingAgent}
        categories={categories}
        onOpenGroupDialog={() => {}}
        onSuccess={refreshAll}
        isAdmin={false}
      />

      {/* 删除确认弹窗 */}
      <Dialog onOpenChange={(o) => !o && setDeleteAgent(null)} open={!!deleteAgent}>
        <DialogContent className="dialog-mobile-friendly max-w-sm">
          <DialogHeader>
            <DialogTitle>删除 OPC？</DialogTitle>
            <DialogDescription>确定要删除「{deleteAgent?.name}」吗？此操作无法撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              className="touch-target rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              onClick={() => setDeleteAgent(null)}
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
    </CategoryProvider>
  );
}
