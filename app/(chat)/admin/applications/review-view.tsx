"use client";

import { useState } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { reviewListingApplicationAction } from "@/lib/opc-market/actions";
import { toast } from "@/components/chat/toast";

type Application = {
  id: string;
  agentId: string;
  agentName: string;
  applicantName: string | null;
  type: string;
  description: string | null;
  status: string;
  createdAt: string;
};

export function ApplicationReviewView({
  applications,
}: {
  applications: Application[];
}) {
  const [pending, setPending] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});

  async function handleReview(
    applicationId: string,
    decision: "approved" | "rejected"
  ) {
    setPending(applicationId);
    try {
      const result = await reviewListingApplicationAction({
        applicationId,
        decision,
        rejectReason: rejectReasons[applicationId],
      });
      if (!result.success) {
        toast({ type: "error", description: result.error || "审核失败" });
      } else {
        toast({
          type: "success",
          description: decision === "approved" ? "已通过" : "已驳回",
        });
        // 刷新页面移除已处理项
        window.location.reload();
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      {applications.length === 0 && (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          暂无待审核申请
        </div>
      )}

      {applications.map((app) => (
        <div
          key={app.id}
          className="rounded-lg border border-border bg-card p-5"
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-foreground">{app.agentName}</h3>
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    app.type === "list"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {app.type === "list" ? "上架申请" : "下架申请"}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                申请人：{app.applicantName || "未知"} ·{" "}
                {new Date(app.createdAt).toLocaleString()}
              </p>
              {app.description && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {app.description}
                </p>
              )}
            </div>
          </div>

          {/* 驳回理由输入 */}
          <div className="mt-4">
            <input
              type="text"
              placeholder="驳回理由（驳回时必填）"
              value={rejectReasons[app.id] || ""}
              onChange={(e) =>
                setRejectReasons({ ...rejectReasons, [app.id]: e.target.value })
              }
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
            />
          </div>

          {/* 操作按钮 */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => handleReview(app.id, "approved")}
              disabled={pending === app.id}
              className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {pending === app.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              通过
            </button>
            <button
              onClick={() => handleReview(app.id, "rejected")}
              disabled={pending === app.id}
              className="flex items-center gap-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              <X className="size-4" />
              驳回
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
