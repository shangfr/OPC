"use client";

import {
  CheckSquare,
  Download,
  Loader2,
  ShieldCheck,
  Square,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Ticket } from "@/lib/db/schema";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "./ticket-shared";

export function TicketBatchBar({
  selectedIds,
  total,
  onClear,
  onRefresh,
  onExport,
}: {
  selectedIds: string[];
  total: number;
  onClear: () => void;
  onRefresh: () => void;
  onExport: (ids: string[]) => void;
}) {
  const [batchStatus, setBatchStatus] = useState<string>("");
  const [batchPriority, setBatchPriority] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleBatchStatus = async () => {
    if (!batchStatus || selectedIds.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          action: "status",
          value: batchStatus,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`已批量更新 ${selectedIds.length} 个工单的状态`);
      setBatchStatus("");
      onClear();
      onRefresh();
    } catch {
      toast.error("批量更新失败");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchPriority = async () => {
    if (!batchPriority || selectedIds.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          action: "priority",
          value: batchPriority,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(`已批量更新 ${selectedIds.length} 个工单的优先级`);
      setBatchPriority("");
      onClear();
      onRefresh();
    } catch {
      toast.error("批量更新失败");
    } finally {
      setLoading(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`确定要删除选中的 ${selectedIds.length} 个工单吗？`))
      return;
    setLoading(true);
    try {
      // 逐个删除（复用 DELETE 接口）
      await Promise.all(
        selectedIds.map((id) =>
          fetch(`/api/tickets?id=${id}`, { method: "DELETE" }),
        ),
      );
      toast.success(`已删除 ${selectedIds.length} 个工单`);
      onClear();
      onRefresh();
    } catch {
      toast.error("批量删除失败");
    } finally {
      setLoading(false);
    }
  };

  // 🆕 批量审核：通过 / 驳回
  const handleBatchReview = async (
    reviewStatus: "approved" | "rejected",
  ) => {
    if (selectedIds.length === 0) return;
    const note =
      reviewStatus === "rejected"
        ? window.prompt("请输入驳回原因（可选）：") || ""
        : "";
    setLoading(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          action: "review",
          value: reviewStatus,
          reviewNote: note || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(
        `已${reviewStatus === "approved" ? "通过" : "驳回"} ${selectedIds.length} 个工单`,
      );
      onClear();
      onRefresh();
    } catch {
      toast.error("批量审核失败");
    } finally {
      setLoading(false);
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2.5 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="flex items-center gap-2 text-sm font-medium">
        <CheckSquare className="size-4 text-primary" />
        已选 {selectedIds.length} / {total}
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {/* 批量改状态 */}
        <div className="flex items-center gap-1">
          <Select onValueChange={setBatchStatus} value={batchStatus}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="改状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">{STATUS_LABELS.pending}</SelectItem>
              <SelectItem value="in_progress">{STATUS_LABELS.in_progress}</SelectItem>
              <SelectItem value="completed">{STATUS_LABELS.completed}</SelectItem>
              <SelectItem value="closed">{STATUS_LABELS.closed}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="h-8"
            disabled={!batchStatus || loading}
            onClick={handleBatchStatus}
            size="sm"
          >
            应用
          </Button>
        </div>

        {/* 批量改优先级 */}
        <div className="flex items-center gap-1">
          <Select onValueChange={setBatchPriority} value={batchPriority}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue placeholder="改优先级" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">{PRIORITY_LABELS.low}</SelectItem>
              <SelectItem value="medium">{PRIORITY_LABELS.medium}</SelectItem>
              <SelectItem value="high">{PRIORITY_LABELS.high}</SelectItem>
              <SelectItem value="urgent">{PRIORITY_LABELS.urgent}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="h-8"
            disabled={!batchPriority || loading}
            onClick={handleBatchPriority}
            size="sm"
          >
            应用
          </Button>
        </div>

        {/* 🆕 批量审核：通过 / 驳回 */}
        <Button
          className="h-8"
          disabled={loading}
          onClick={() => handleBatchReview("approved")}
          size="sm"
          variant="outline"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="size-3.5" />
          )}
          通过
        </Button>
        <Button
          className="h-8"
          disabled={loading}
          onClick={() => handleBatchReview("rejected")}
          size="sm"
          variant="outline"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <XCircle className="size-3.5" />
          )}
          驳回
        </Button>

        {/* 导出 */}
        <Button
          className="h-8"
          onClick={() => onExport(selectedIds)}
          size="sm"
          variant="outline"
        >
          <Download className="size-3.5" />
          导出
        </Button>

        {/* 批量删除 */}
        <Button
          className="h-8"
          disabled={loading}
          onClick={handleBatchDelete}
          size="sm"
          variant="destructive"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Trash2 className="size-3.5" />
          )}
          删除
        </Button>

        {/* 清除选择 */}
        <Button
          className="h-8"
          onClick={onClear}
          size="icon-sm"
          variant="ghost"
        >
          <X className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

/** CSV 导出工具函数 */
export function exportTicketsCSV(tickets: Ticket[], filename = "tickets.csv") {
  const headers = [
    "ID",
    "标题",
    "描述",
    "优先级",
    "状态",
    "进度",
    "负责人",
    "截止日期",
    "分类ID",
    "可见性",
    "启用",
    "创建时间",
    "更新时间",
  ];

  const escapeCSV = (val: unknown): string => {
    const s = String(val ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = tickets.map((t) =>
    [
      t.id,
      t.title,
      t.description,
      PRIORITY_LABELS[t.priority as keyof typeof PRIORITY_LABELS],
      STATUS_LABELS[t.status as keyof typeof STATUS_LABELS],
      t.progress,
      t.assignee ?? "",
      t.dueDate ? new Date(t.dueDate).toLocaleString("zh-CN") : "",
      t.categoryId ?? "",
      t.visibility,
      t.isActive ? "是" : "否",
      new Date(t.createdAt).toLocaleString("zh-CN"),
      new Date(t.updatedAt).toLocaleString("zh-CN"),
    ]
      .map(escapeCSV)
      .join(",")
  );

  // BOM 头确保 Excel 正确识别 UTF-8
  const csv = "\uFEFF" + [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
