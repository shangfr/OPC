"use client";
import { FolderTree, Home, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Agent } from "@/lib/db/schema";
import { AgentFormDialog } from "./agent-form-dialog";
import { GroupManagerDialog } from "./group-manager-dialog";
import { AgentCard, CategoryProvider, GroupHeader, useAgents } from "./opc-shared";
import { SiteConfigDialog } from "./site-config-dialog";

export function AgentManager() {
  const { agents, categories, loading, refresh, adminGroups, handleStartChat, ctxValue, setCategories } = useAgents();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Agent | null>(null);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);

  const openCreate = () => {
    setEditingAgent(null);
    setDialogOpen(true);
  };

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      const res = await fetch(`/api/agents?id=${deleteConfirm.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("OPC 已删除");
      setDeleteConfirm(null);
      refresh();
    } catch {
      toast.error("删除失败，请重试");
    }
  };

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

  const { groups, ungrouped } = adminGroups;
  const totalAgents = agents.length;
  const activeAgents = agents.filter(a => a.isActive).length;

  return (
    <CategoryProvider value={ctxValue}>
      <div className="page-container">
        {/* 页面标题 + 统计 */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-foreground">OPC 智库管理</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                管理平台 OPC 角色、分类和站点配置
              </p>
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                <span>共 <span className="font-medium text-foreground">{totalAgents}</span> 个 OPC</span>
                <span>·</span>
                <span><span className="font-medium text-emerald-600">{activeAgents}</span> 启用</span>
                <span>·</span>
                <span><span className="font-medium text-muted-foreground">{totalAgents - activeAgents}</span> 停用</span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild className="gap-1.5" size="sm" variant="ghost">
                <Link href="/">
                  <Home className="size-3.5" />
                  <span className="hidden sm:inline">返回主页</span>
                </Link>
              </Button>
              <Button className="gap-1.5" onClick={() => setGroupDialogOpen(true)} size="sm" variant="ghost">
                <FolderTree className="size-3.5" />
                <span className="hidden sm:inline">管理分组</span>
              </Button>
              <SiteConfigDialog />
              <Button className="gap-2" onClick={openCreate}>
                <Plus className="size-4" />
                <span className="hidden sm:inline">新建 OPC</span>
                <span className="sm:hidden">新建</span>
              </Button>
            </div>
          </div>
        </div>

        {agents.length === 0 && (
          <div className="empty-state">
            <Plus className="mb-4 size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">还没有任何 OPC</p>
            <Button className="mt-4 gap-2" onClick={openCreate} variant="outline">
              <Plus className="size-4" />
              创建第一个 AI OPC
            </Button>
          </div>
        )}

        {groups.map(({ group, agents: groupAgents }) => (
          <section className="mb-10" key={group.key}>
            <GroupHeader count={groupAgents.length} group={group} />
            <div className="card-grid">
              {groupAgents.map((agent) => (
                <AgentCard 
                  admin 
                  agent={agent} 
                  key={agent.id} 
                  onChat={agent.isActive ? handleStartChat : undefined} 
                  onDelete={(a) => setDeleteConfirm(a)} 
                  onEdit={openEdit} 
                />
              ))}
            </div>
          </section>
        ))}

        {ungrouped.length > 0 && (
          <section className="mb-10">
            <GroupHeader count={ungrouped.length} group={{ bg: "bg-slate-400", label: "其他" }} />
            <div className="card-grid">
              {ungrouped.map((agent) => (
                <AgentCard 
                  admin 
                  agent={agent} 
                  key={agent.id} 
                  onChat={agent.isActive ? handleStartChat : undefined} 
                  onDelete={(a) => setDeleteConfirm(a)} 
                  onEdit={openEdit} 
                />
              ))}
            </div>
          </section>
        )}

        {/* 使用抽取出来的共享表单组件 */}
        <AgentFormDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editingAgent={editingAgent}
          categories={categories}
          onOpenGroupDialog={() => setGroupDialogOpen(true)}
          onSuccess={refresh}
          isAdmin={true}
        />

        <Dialog onOpenChange={(open) => !open && setDeleteConfirm(null)} open={!!deleteConfirm}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
              <DialogDescription>确定要删除 OPC「{deleteConfirm?.name}」吗？此操作不可撤销。</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setDeleteConfirm(null)} variant="outline">取消</Button>
              <Button onClick={handleDelete} variant="destructive">删除</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <GroupManagerDialog
          onGroupsChange={async () => {
            try {
              const res = await fetch("/api/categories");
              if (res.ok) {
                const latestCategories = await res.json();
                if (setCategories) setCategories(latestCategories);
                refresh();
              }
            } catch (error) {
              console.error("刷新分类列表失败", error);
            }
          }}
          onOpenChange={setGroupDialogOpen}
          open={groupDialogOpen}
        />
      </div>
    </CategoryProvider>
  );
}
