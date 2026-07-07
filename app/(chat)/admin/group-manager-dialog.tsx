"use client";

import {
  Check,
  FolderTree,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { COLOR_KEYS, COLOR_THEMES } from "@/lib/agent-groups";
import type { Category } from "@/lib/db/schema";

type GroupRecord = Category & { sortOrder: number; colorKey: string };

export function GroupManagerDialog({
  open,
  onOpenChange,
  onGroupsChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGroupsChange: (groups: GroupRecord[]) => void;
}) {
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [newName, setNewName] = useState("");
  const [newColorKey, setNewColorKey] = useState(COLOR_KEYS[0]);
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColorKey, setEditColorKey] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadGroups = async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data: GroupRecord[] = await res.json();
        setGroups(data);
        onGroupsChange(data);
      }
    } catch {
      toast.error("获取分组列表失败");
    }
  };

  useEffect(() => {
    if (open) loadGroups();
  }, [open]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("请输入分组名称");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          colorKey: newColorKey,
          sortOrder: newSortOrder,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("分组已创建");
      setNewName("");
      setNewColorKey(COLOR_KEYS[0]);
      setNewSortOrder(
        groups.length > 0 ? Math.max(...groups.map((g) => g.sortOrder)) + 1 : 0
      );
      await loadGroups();
    } catch {
      toast.error("创建分组失败");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) {
      toast.error("请输入分组名称");
      return;
    }
    try {
      const res = await fetch(`/api/categories?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          colorKey: editColorKey,
          sortOrder: editSortOrder,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("分组已更新");
      setEditingId(null);
      await loadGroups();
    } catch {
      toast.error("更新分组失败");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/categories?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("分组已删除");
      await loadGroups();
    } catch {
      toast.error("删除分组失败");
    }
  };

  const startEdit = (cat: GroupRecord) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColorKey(cat.colorKey ?? "indigo");
    setEditSortOrder(cat.sortOrder ?? 0);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderTree className="size-4" />
            分组管理
          </DialogTitle>
          <DialogDescription>
            管理 OPC 的业务分组，控制显示排序和配色方案
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 新建分组 */}
          <div className="space-y-3 rounded-xl border border-border/50 bg-muted/30 p-3">
            <p className="text-xs font-medium text-foreground">新建分组</p>
            <div className="flex items-center gap-2">
              <Input
                className="h-8 flex-1 text-sm"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                placeholder="分组名称"
                value={newName}
              />
              <Input
                className="h-8 w-20 text-sm"
                onChange={(e) => setNewSortOrder(Number(e.target.value))}
                placeholder="排序"
                type="number"
                value={newSortOrder}
              />
              <Button
                className="h-8 shrink-0 gap-1"
                disabled={loading || !newName.trim()}
                onClick={handleCreate}
                size="sm"
              >
                <Plus className="size-3" />
                添加
              </Button>
            </div>
            {/* 配色选择 */}
            <div className="flex flex-wrap gap-1.5">
              {COLOR_KEYS.map((key) => {
                const theme = COLOR_THEMES[key];
                return (
                  <button
                    aria-label={key}
                    className={`flex size-7 items-center justify-center rounded-lg transition-all ${theme.bg} ${
                      newColorKey === key
                        ? "scale-110 ring-2 ring-offset-1 ring-foreground/40"
                        : "opacity-60 hover:opacity-100 hover:scale-110"
                    }`}
                    key={key}
                    onClick={() => setNewColorKey(key)}
                    title={key}
                    type="button"
                  >
                    <span className="text-[8px] font-bold text-white uppercase">
                      {(key.slice(0, 2))}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 分组列表 */}
          <div className="space-y-1">
            {groups.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                暂无分组，在上方新建
              </p>
            ) : (
              groups.map((cat) => {
                const theme = COLOR_THEMES[cat.colorKey] ?? COLOR_THEMES.indigo;
                return (
                  <div
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
                    key={cat.id}
                  >
                    <GripVertical className="size-3.5 shrink-0 text-muted-foreground/40" />

                    {editingId === cat.id ? (
                      /* 编辑模式 */
                      <>
                        <div className="flex flex-wrap gap-1">
                          {COLOR_KEYS.map((key) => {
                            const t = COLOR_THEMES[key];
                            return (
                              <button
                                className={`flex size-6 items-center justify-center rounded-md transition-all ${t.bg} ${
                                  editColorKey === key
                                    ? "scale-110 ring-2 ring-offset-1 ring-foreground/40"
                                    : "opacity-60 hover:opacity-100"
                                }`}
                                key={key}
                                onClick={() => setEditColorKey(key)}
                                title={key}
                                type="button"
                              >
                                <span className="text-[7px] font-bold text-white uppercase">
                                  {(key.slice(0, 2))}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        <Input
                          className="h-7 flex-1 text-sm"
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleUpdate(cat.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          value={editName}
                        />
                        <Input
                          className="h-7 w-16 text-sm"
                          onChange={(e) =>
                            setEditSortOrder(Number(e.target.value))
                          }
                          type="number"
                          value={editSortOrder}
                        />
                        <button
                          className="rounded-md p-1 text-emerald-600 transition-colors hover:bg-emerald-50"
                          onClick={() => handleUpdate(cat.id)}
                          type="button"
                        >
                          <Check className="size-3.5" />
                        </button>
                        <button
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted"
                          onClick={() => setEditingId(null)}
                          type="button"
                        >
                          <X className="size-3.5" />
                        </button>
                      </>
                    ) : (
                      /* 查看模式 */
                      <>
                        <span
                          className={`inline-flex size-5 shrink-0 items-center justify-center rounded-md ${theme.bg}`}
                        >
                          <span className="text-[7px] font-bold text-white uppercase">
                            {(cat.colorKey ?? "indigo").slice(0, 2)}
                          </span>
                        </span>
                        <span className="flex-1 text-sm font-medium">
                          {cat.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          #{cat.sortOrder}
                        </span>
                        <button
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted"
                          onClick={() => startEdit(cat)}
                          type="button"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          className="rounded-md p-1 text-destructive/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => {
                            if (
                              window.confirm(
                                `确定要删除分组「${cat.name}」吗？相关 OPC 的分组将被清空。`
                              )
                            ) {
                              handleDelete(cat.id);
                            }
                          }}
                          type="button"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">
            完成
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
