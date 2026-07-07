"use client";

import { Check, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
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
import type { Category } from "@/lib/db/schema";

const CATEGORY_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#8b5cf6",
  "#0ea5e9",
  "#f97316",
  "#f43f5e",
  "#3b82f6",
  "#14b8a6",
  "#ec4899",
];

export function CategoryManagerDialog({
  open,
  onOpenChange,
  onCategoriesChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCategoriesChange: (categories: Category[]) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(CATEGORY_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [loading, setLoading] = useState(false);

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
        onCategoriesChange(data);
      }
    } catch {
      toast.error("获取分类列表失败");
    }
  };

  useEffect(() => {
    if (open) loadCategories();
  }, [open]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      toast.error("请输入分类名称");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (!res.ok) throw new Error();
      toast.success("分类已创建");
      setNewName("");
      setNewColor(CATEGORY_COLORS[0]);
      await loadCategories();
    } catch {
      toast.error("创建分类失败");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) {
      toast.error("请输入分类名称");
      return;
    }
    try {
      const res = await fetch(`/api/categories?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), color: editColor }),
      });
      if (!res.ok) throw new Error();
      toast.success("分类已更新");
      setEditingId(null);
      await loadCategories();
    } catch {
      toast.error("更新分类失败");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/categories?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success("分类已删除");
      await loadCategories();
    } catch {
      toast.error("删除分类失败");
    }
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditColor(cat.color);
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="size-4" />
            分类管理
          </DialogTitle>
          <DialogDescription>
            管理 OPC 分类标签，创建后可在 OPC 编辑时选择
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 新建分类 */}
          <div className="space-y-3 rounded-xl border border-border/50 bg-muted/30 p-3">
            <p className="text-xs font-medium text-foreground">新建分类</p>
            <div className="flex items-center gap-2">
              <Input
                className="h-8 text-sm"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                placeholder="分类名称"
                value={newName}
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
            {/* 颜色选择 */}
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_COLORS.map((color) => (
                <button
                  aria-label={color}
                  className={`size-6 rounded-full transition-all ${
                    newColor === color
                      ? "scale-110 ring-2 ring-offset-1 ring-foreground/40"
                      : "hover:scale-110"
                  }`}
                  key={color}
                  onClick={() => setNewColor(color)}
                  style={{ backgroundColor: color }}
                  type="button"
                />
              ))}
            </div>
          </div>

          {/* 分类列表 */}
          <div className="space-y-1">
            {categories.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                暂无分类，在上方新建
              </p>
            ) : (
              categories.map((cat) => (
                <div
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/50"
                  key={cat.id}
                >
                  {editingId === cat.id ? (
                    /* 编辑模式 */
                    <>
                      <div className="flex flex-wrap gap-1">
                        {CATEGORY_COLORS.map((color) => (
                          <button
                            aria-label={color}
                            className={`size-5 rounded-full transition-all ${
                              editColor === color
                                ? "scale-110 ring-2 ring-offset-1 ring-foreground/40"
                                : "opacity-60 hover:opacity-100 hover:scale-110"
                            }`}
                            key={color}
                            onClick={() => setEditColor(color)}
                            style={{ backgroundColor: color }}
                            type="button"
                          />
                        ))}
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
                        className="inline-block size-3 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="flex-1 text-sm">{cat.name}</span>
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
                              `确定要删除分类「${cat.name}」吗？相关 OPC 的分类将被清空。`
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
              ))
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
