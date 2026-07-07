"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Ticket, TicketCategory } from "@/lib/db/schema";
import { STATUS_LABELS, type TicketStatus } from "@/lib/ticket-status-machine";
import { cn } from "@/lib/utils";
import {
  TicketCard,
} from "./ticket-shared";

const KANBAN_COLUMNS: { status: TicketStatus; label: string; color: string }[] = [
  { status: "pending", label: STATUS_LABELS.pending, color: "bg-slate-400" },
  { status: "in_progress", label: STATUS_LABELS.in_progress, color: "bg-blue-500" },
  { status: "completed", label: STATUS_LABELS.completed, color: "bg-green-500" },
  { status: "closed", label: STATUS_LABELS.closed, color: "bg-gray-500" },
];

export function TicketKanban({
  tickets,
  categories,
  onEdit,
  onDelete,
  onStatusChange,
  onTicketClick,
}: {
  tickets: Ticket[];
  categories: TicketCategory[];
  onEdit?: (ticket: Ticket) => void;
  onDelete?: (ticket: Ticket) => void;
  onStatusChange?: (ticket: Ticket, newStatus: TicketStatus) => Promise<void>;
  onTicketClick?: (ticket: Ticket) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TicketStatus | null>(null);
  const [updating, setUpdating] = useState(false);

  const handleDragStart = (e: React.DragEvent, ticketId: string) => {
    setDraggingId(ticketId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", ticketId);
  };

  const handleDragOver = (e: React.DragEvent, status: TicketStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget(status);
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: TicketStatus) => {
    e.preventDefault();
    setDropTarget(null);
    const ticketId = e.dataTransfer.getData("text/plain");
    const draggedTicket = tickets.find((t) => t.id === ticketId);
    if (!draggedTicket || draggedTicket.status === targetStatus) {
      setDraggingId(null);
      return;
    }
    setUpdating(true);
    try {
      await onStatusChange?.(draggedTicket, targetStatus);
      toast.success(
        `「${draggedTicket.title}」已移至「${KANBAN_COLUMNS.find((c) => c.status === targetStatus)?.label}」`
      );
    } catch {
      toast.error("状态更新失败");
    } finally {
      setUpdating(false);
      setDraggingId(null);
    }
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {KANBAN_COLUMNS.map((col) => {
        const colTickets = tickets.filter(
          (t) => t.status === col.status
        );
        const isDropTarget = dropTarget === col.status;
        return (
          <div
            className={cn(
              "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/20 transition-colors",
                isDropTarget && "border-primary/50 bg-primary/5"
              )}
              key={col.status}
              onDragLeave={() => setDropTarget(null)}
              onDragOver={(e) => handleDragOver(e, col.status)}
              onDrop={(e) => handleDrop(e, col.status)}
            >
              {/* Column Header */}
              <div className="flex items-center justify-between border-b border-border/40 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", col.color)} />
                  <span className="text-xs font-semibold">{col.label}</span>
                </div>
                <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-medium">
                  {colTickets.length}
                </span>
              </div>

              {/* Column Body */}
              <div className="flex-1 space-y-2 overflow-y-auto p-2" style={{ minHeight: "200px" }}>
                {updating && draggingId && (
                  <div className="flex items-center justify-center py-4 text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                  </div>
                )}
                {colTickets.length === 0 && !updating && (
                  <div className="flex h-20 items-center justify-center rounded-lg border border-dashed border-border/40 text-[11px] text-muted-foreground">
                    拖拽工单到此列
                  </div>
                )}
                {colTickets.map((t) => (
                  <div
                    className="cursor-grab active:cursor-grabbing"
                    draggable
                    key={t.id}
                    onDragEnd={() => setDraggingId(null)}
                    onDragStart={(e) => handleDragStart(e, t.id)}
                    onClick={() => onTicketClick?.(t)}
                  >
                    <TicketCard
                      admin={!!onEdit}
                      onDelete={onDelete}
                      onEdit={onEdit}
                      ticket={t}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
  );
}
