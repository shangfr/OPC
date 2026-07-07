"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Settings2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import type { Agent, Category } from "@/lib/db/schema";
import { KnowledgeSection } from "./knowledge-section";

type AgentFormData = {
  name: string;
  description: string;
  avatar: string;
  systemPrompt: string;
  phone: string;
  knowledgeId: string;
  starterQuestions: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
  categoryId: string;
  visibility: "public" | "private"; // 兼容旧字段，实际可见性由 listingStatus/ownershipType 决定
};

// 上架状态展示映射（只读，避免与审核上架流程冲突）
const listingStatusMeta: Record<
  string,
  { text: string; className: string; hint: string }
> = {
  private: {
    text: "私有",
    className: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
    hint: "仅创建者可见。如需公开到发现广场，请在「我的 OPC」中提交上架申请，经管理员审核通过后上架。",
  },
  pending: {
    text: "审核中",
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    hint: "上架申请已提交，等待管理员审核。审核通过后将自动公开到发现广场。",
  },
  listed: {
    text: "已上架",
    className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    hint: "已公开到发现广场，所有用户可见。如需下架，请在「我的 OPC」中操作。",
  },
  delisted: {
    text: "已下架",
    className: "bg-destructive/10 text-destructive",
    hint: "已被管理员强制下架，不再对全站可见。已订阅企业可用至订阅周期结束。",
  },
};

const emptyForm: AgentFormData = {
  name: "",
  description: "",
  avatar: "/icon.png",
  systemPrompt: "",
  phone: "",
  knowledgeId: "__none__",
  starterQuestions: "",
  isActive: true,
  isDefault: false,
  sortOrder: 0,
  categoryId: "__none__",
  visibility: "public", // 默认公开
};

export function AgentFormDialog({
  open,
  onOpenChange,
  editingAgent,
  categories,
  onOpenGroupDialog,
  onSuccess,
  isAdmin = false
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAgent: Agent | null;
  categories: Category[];
  onOpenGroupDialog: () => void;
  onSuccess: () => void;
  isAdmin?: boolean;
}) {
  const [form, setForm] = useState<AgentFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  // 当前 OPC 的上架状态（只读展示，避免与审核上架流程冲突）
  const [currentListingStatus, setCurrentListingStatus] = useState<string>(
    "private"
  );

  useEffect(() => {
    if (open) {
      if (editingAgent) {
        setForm({
          name: editingAgent.name,
          description: editingAgent.description,
          avatar: editingAgent.avatar,
          systemPrompt: editingAgent.systemPrompt,
          phone: editingAgent.phone ?? "",
          knowledgeId: editingAgent.knowledgeId ?? "__none__",
          starterQuestions: (editingAgent.starterQuestions ?? []).join("\n"),
          isActive: editingAgent.isActive,
          isDefault: editingAgent.isDefault,
          sortOrder: editingAgent.sortOrder,
          categoryId: editingAgent.categoryId ?? "__none__",
          visibility: (editingAgent as any).visibility ?? "public", // 兼容旧字段
        });
        // 读取当前上架状态用于只读展示
        setCurrentListingStatus(
          (editingAgent as any).listingStatus ?? "private"
        );
      } else {
        setForm(emptyForm);
        setCurrentListingStatus("private");
      }
    }
  }, [open, editingAgent]);

  const handleSave = async () => {
    if (!form.name.trim() || !form.description.trim() || !form.systemPrompt.trim()) {
      toast.error("请填写所有必填字段");
      return;
    }

    const payload = {
      ...form,
      starterQuestions: form.starterQuestions.split("\n").map((s) => s.trim()).filter(Boolean),
      knowledgeId: form.knowledgeId === "__none__" ? null : form.knowledgeId,
      // 普通用户强制覆盖以下字段，防止越权
      categoryId: isAdmin ? (form.categoryId === "__none__" ? null : form.categoryId) : null,
      isDefault: isAdmin ? form.isDefault : false,
      sortOrder: isAdmin ? form.sortOrder : 0,
      // 可见性由上架状态决定，不再由表单开关控制（避免与审核上架流程冲突）
      // 普通用户始终 private；管理员保持与当前 listingStatus 一致
      visibility:
        !isAdmin || currentListingStatus === "private"
          ? "private"
          : "public",
    };

    setSaving(true);
    try {
      if (editingAgent) {
        const res = await fetch(`/api/agents?id=${editingAgent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to update");
        toast.success("OPC 已更新");
      } else {
        const res = await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Failed to create");
        toast.success("OPC 已创建");
      }
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="dialog-mobile-friendly max-h-[90dvh] max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingAgent ? "编辑 OPC" : "新建 OPC"}</DialogTitle>
          <DialogDescription>
            {editingAgent ? "修改 OPC 角色的名称、描述和系统提示词" : "创建一个新的 OPC 角色配置"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* ... 其他表单字段保持不变 ... */}
          <div className="space-y-2">
            <Label htmlFor="name">名称 *</Label>
            <Input id="name" onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如：技术支持助手" value={form.name} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="avatar">头像 URL</Label>
            <Input id="avatar" onChange={(e) => setForm({ ...form, avatar: e.target.value })} placeholder="/icon.png" value={form.avatar} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">手机号</Label>
            <Input id="phone" onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="例如：13800138000" value={form.phone} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">描述 *</Label>
            <Textarea className="min-h-[60px]" id="desc" onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="简短描述 OPC 的角色定位..." value={form.description} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prompt">系统提示词 *</Label>
            <Textarea className="min-h-[120px] font-mono text-xs" id="prompt" onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })} placeholder="你是一个乐于助人的 AI 助手..." value={form.systemPrompt} />
          </div>
          <KnowledgeSection onChange={(v) => setForm({ ...form, knowledgeId: v })} value={form.knowledgeId} />
          <div className="space-y-2">
            <Label htmlFor="starterQuestions">默认问题</Label>
            <Textarea className="min-h-[80px] text-xs" id="starterQuestions" onChange={(e) => setForm({ ...form, starterQuestions: e.target.value })} placeholder={"每行一个问题，最多 8 个\n例如：\n你好，你能帮我做什么？\n请介绍一下你的专业能力"} value={form.starterQuestions} />
            <p className="text-[11px] text-muted-foreground">用户进入该 OPC 聊天时显示的默认引导问题，每行一个</p>
          </div>

          {/* 仅管理员可见：分组选择 */}
          {isAdmin && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>所属分组</Label>
                <button
                  className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  onClick={onOpenGroupDialog}
                  type="button"
                >
                  <Settings2 className="size-3" />
                  管理分组
                </button>
              </div>
              <div className="flex items-center gap-2">
                <Select onValueChange={(v) => setForm({ ...form, categoryId: v })} value={form.categoryId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="无分组" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      <span className="text-muted-foreground">无分组</span>
                    </SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="mr-2 inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: cat.color }} />
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.categoryId && form.categoryId !== "__none__" && (() => {
                  const cat = categories.find((c) => c.id === form.categoryId);
                  return cat ? (
                    <Badge
                      className="shrink-0 gap-1 px-2 py-0.5 text-[11px]"
                      style={{ borderColor: cat.color + "40", backgroundColor: cat.color + "10", color: cat.color }}
                      variant="outline"
                    >
                      <span className="inline-block size-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      {cat.name}
                    </Badge>
                  ) : null;
                })()}
              </div>
            </div>
          )}

          {/* 仅管理员可见：设为默认 OPC */}
          {isAdmin && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/15 bg-amber-500/[0.03] px-3 py-2.5">
              <Switch checked={form.isDefault} id="isDefault" onCheckedChange={(v) => setForm({ ...form, isDefault: v })} />
              <Label className="cursor-pointer text-sm" htmlFor="isDefault">设为默认 OPC</Label>
              <span className="ml-auto text-[11px] text-muted-foreground">「开始对话」将使用此 OPC 的配置</span>
            </div>
          )}

          {/* 上架状态展示（只读，避免与审核上架流程冲突） */}
          {editingAgent && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm">上架状态</Label>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    (
                      listingStatusMeta[currentListingStatus] ??
                      listingStatusMeta.private
                    ).className
                  }`}
                >
                  {(
                    listingStatusMeta[currentListingStatus] ??
                    listingStatusMeta.private
                  ).text}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                {(
                  listingStatusMeta[currentListingStatus] ??
                  listingStatusMeta.private
                ).hint}
              </p>
            </div>
          )}
          {!editingAgent && (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                新建 OPC 默认为私有状态。创建后可在「我的 OPC」中提交上架申请，经管理员审核通过后公开到发现广场。
              </p>
            </div>
          )}

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 rounded-lg border border-blue-500/15 bg-blue-500/[0.03] px-3 py-2.5">
              <Switch checked={form.isActive} id="active" onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label className="cursor-pointer" htmlFor="active">启用</Label>
            </div>
            {/* 仅管理员可见：排序 */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <Label className="shrink-0" htmlFor="order">排序</Label>
                <Input
                  className="w-20"
                  id="order"
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) || 0 })}
                  type="number"
                  value={form.sortOrder}
                />
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">取消</Button>
          <Button disabled={saving} onClick={handleSave}>
            {saving ? "保存中..." : editingAgent ? "保存修改" : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
