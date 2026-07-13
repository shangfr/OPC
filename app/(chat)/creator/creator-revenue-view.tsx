"use client";
import { useState } from "react";
import { Loader2, Upload, RotateCcw, XCircle } from "lucide-react";
import { toast } from "sonner";
import {
  submitListingApplicationAction,
  withdrawListingApplicationAction,
  getMyApplicationsAction,
} from "@/lib/opc-market/actions";
import { Users, DollarSign, Package, TrendingUp } from "lucide-react";
import { useEffect, useCallback } from "react";

type Summary = {
  totalRevenue: string | number | null;
  monthRevenue: string | number | null;
  opcCount: string | number | null;
  totalSubscriptions: string | number | null;
};

type OpcStat = {
  id: string;
  name: string;
  description: string | null;
  ownershipType: string;
  listingStatus: string;
  priceMonthly: number;
  priceYearly: number;
  activeSubscriberCount: number;
  totalRevenue: string | number | null;
};

type RevenueItem = {
  id: string;
  agentName: string;
  enterpriseName: string | null;
  orderAmount: number;
  revenuePercent: number;
  revenueAmount: number;
  settleStatus: string;
  createdAt: string;
};

type ListingApplication = {
  id: string;
  agentId: string;
  agentName: string;
  status: string;
  type: string;
  rejectReason?: string | null;
  reviewedAt?: Date | string | null;
};

const listingStatusText: Record<string, string> = {
  private: "私有",
  pending: "审核中",
  listed: "已上架",
  delisted: "已下架",
};

const listingStatusColor: Record<string, string> = {
  private: "bg-gray-100 text-gray-600",
  pending: "bg-amber-100 text-amber-700",
  listed: "bg-green-100 text-green-700",
  delisted: "bg-red-100 text-red-700",
};

const formatYuan = (fen: string | number | null) => {
  const n = typeof fen === "string" ? parseInt(fen, 10) : fen ?? 0;
  return `¥${(n / 100).toFixed(2)}`;
};

export function CreatorRevenueView({
  accountType = "personal",
  summary,
  opcStats,
  revenueList,
}: {
  accountType?: "personal" | "enterprise";
  summary: Summary;
  opcStats: OpcStat[];
  revenueList: RevenueItem[];
}) {
  const [tab, setTab] = useState<"opcs" | "revenue">("opcs");
  const [listingPending, setListingPending] = useState<string | null>(null);
  const [withdrawPending, setWithdrawPending] = useState<string | null>(null);
  const [applications, setApplications] = useState<ListingApplication[]>([]);

  // 加载当前用户的申请记录（含 pending + rejected，用于驳回提示）
  const loadApplications = useCallback(async () => {
    try {
      const apps = await getMyApplicationsAction();
      // 保留 pending（审核中）和 rejected（已驳回，需提示用户）
      setApplications(apps.filter((a: any) => a.status === "pending" || a.status === "rejected"));
    } catch {
      // 静默忽略
    }
  }, []);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  async function handleListOpc(agentId: string) {
    setListingPending(agentId);
    try {
      const result = await submitListingApplicationAction({
        agentId,
        type: "list",
        description: "申请上架到公开市场",
      });
      if (result.success) {
        toast.success("上架申请已提交，等待管理员审核");
        await loadApplications();
      } else {
        toast.error(result.error || "提交失败");
      }
    } catch {
      toast.error("提交失败，请稍后重试");
    } finally {
      setListingPending(null);
    }
  }

  async function handleWithdraw(applicationId: string) {
    setWithdrawPending(applicationId);
    try {
      const result = await withdrawListingApplicationAction({
        applicationId,
      });
      if (result.success) {
        toast.success("申请已撤回");
        await loadApplications();
      } else {
        toast.error(result.error || "撤回失败");
      }
    } catch {
      toast.error("撤回失败，请稍后重试");
    } finally {
      setWithdrawPending(null);
    }
  }

  // 查找某个 OPC 的 pending 申请
  function getPendingApp(agentId: string): ListingApplication | undefined {
    return applications.find((a) => a.agentId === agentId && a.status === "pending");
  }

  // 查找某个 OPC 的 rejected 申请（用于驳回提示）
  function getRejectedApp(agentId: string): ListingApplication | undefined {
    return applications.find((a) => a.agentId === agentId && a.status === "rejected");
  }

  // 关闭驳回提示（从本地 state 移除）
  function dismissRejected(agentId: string) {
    setApplications((prev) => prev.filter((a) => !(a.agentId === agentId && a.status === "rejected")));
  }

  const isEnterprise = accountType === "enterprise";
  const opcLabel = isEnterprise ? "团队 OPC" : "我的 OPC";

  return (
    <div className="mt-6 space-y-6 sm:mt-8">
      {/* 角色标识横幅：区分个人创作者与企业团队管理员视图 */}
      <div
        className={`flex items-start gap-3 rounded-lg border p-4 ${
          isEnterprise
            ? "border-blue-500/20 bg-blue-500/[0.04]"
            : "border-emerald-500/20 bg-emerald-500/[0.04]"
        }`}
      >
        <div
          className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${
            isEnterprise ? "bg-blue-500/10" : "bg-emerald-500/10"
          }`}
        >
          {isEnterprise ? (
            <Users className="size-4 text-blue-600 dark:text-blue-400" />
          ) : (
            <DollarSign className="size-4 text-emerald-600 dark:text-emerald-400" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">
            {isEnterprise ? "企业团队管理员视图" : "个人创作者视图"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {isEnterprise
              ? "管理团队创建的 OPC 与订阅副本，可申请上架到公开市场。收益结算仅对个人创作者开放，企业账号不显示收益数据。"
              : "管理名下 OPC 的上架状态、订阅情况与收益明细。可将 OPC 申请上架到公开市场，由企业团队订阅后获得分成收益。"}
          </p>
        </div>
      </div>

      {/* 汇总卡片：个人创作者显示收益，企业管理员显示团队 OPC 指标 */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {isEnterprise ? (
          <>
            {/* 企业管理员：团队 OPC 概览（不显示收益，收益仅个人创作者可用） */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="size-4" />
                <span className="text-xs">团队 OPC</span>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">
                {summary.opcCount ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="size-4" />
                <span className="text-xs">已上架</span>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">
                {opcStats.filter((o) => o.listingStatus === "listed").length}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="size-4" />
                <span className="text-xs">审核中</span>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">
                {opcStats.filter((o) => o.listingStatus === "pending").length}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="size-4" />
                <span className="text-xs">私有 OPC</span>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">
                {opcStats.filter((o) => o.listingStatus === "private").length}
              </p>
            </div>
          </>
        ) : (
          <>
            {/* 个人创作者：收益概览 */}
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <DollarSign className="size-4" />
                <span className="text-xs">总收益</span>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">
                {formatYuan(summary.totalRevenue)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="size-4" />
                <span className="text-xs">本月收益</span>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">
                {formatYuan(summary.monthRevenue)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Package className="size-4" />
                <span className="text-xs">OPC 数量</span>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">
                {summary.opcCount ?? 0}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="size-4" />
                <span className="text-xs">活跃订阅</span>
              </div>
              <p className="mt-2 text-xl font-bold text-foreground">
                {summary.totalSubscriptions ?? 0}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setTab("opcs")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "opcs"
              ? "border-b-2 border-primary text-primary"
              : "text-muted-foreground"
          }`}
        >
          {opcLabel}（{opcStats.length}）
        </button>
        {!isEnterprise && (
          <button
            onClick={() => setTab("revenue")}
            className={`px-4 py-2 text-sm font-medium ${
              tab === "revenue"
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground"
            }`}
          >
            收益明细（{revenueList.length}）
          </button>
        )}
      </div>

      {/* OPC 列表 */}
      {tab === "opcs" && (
        <div className="space-y-3">
          {opcStats.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {isEnterprise ? "团队还没有创建任何 OPC" : "你还没有创建任何 OPC"}
            </p>
          )}
          {opcStats.map((opc) => {
            const pendingApp = getPendingApp(opc.id);
            const rejectedApp = getRejectedApp(opc.id);
            return (
              <div
                key={opc.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-foreground">{opc.name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {opc.description || "暂无描述"}
                    </p>
                  </div>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${listingStatusColor[opc.listingStatus] ?? ""}`}
                  >
                    {listingStatusText[opc.listingStatus] ?? opc.listingStatus}
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-6 text-xs text-muted-foreground">
                  {!isEnterprise && (
                    <>
                      <span>
                        订阅企业：<strong className="text-foreground">{opc.activeSubscriberCount}</strong>
                      </span>
                      <span>
                        累计收益：<strong className="text-foreground">{formatYuan(opc.totalRevenue)}</strong>
                      </span>
                    </>
                  )}
                  <span>
                    月费：<strong className="text-foreground">{formatYuan(opc.priceMonthly)}</strong>
                  </span>
                </div>
                {/* 上架申请 / 撤回按钮 */}
                {opc.listingStatus === "private" && (
                  <div className="mt-3 border-t border-border/50 pt-3">
                    <button
                      onClick={() => handleListOpc(opc.id)}
                      disabled={listingPending === opc.id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                    >
                      {listingPending === opc.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Upload className="size-3" />
                      )}
                      申请上架到公开市场
                    </button>
                    <span className="ml-2 text-xs text-muted-foreground">
                      上架后可被企业订阅{isEnterprise ? "" : "，获得收益分成"}
                    </span>
                  </div>
                )}
                {opc.listingStatus === "pending" && pendingApp && (
                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                    <span className="text-xs text-amber-600">
                      ⏳ 上架申请审核中，请耐心等待管理员审核
                    </span>
                    <button
                      onClick={() => handleWithdraw(pendingApp.id)}
                      disabled={withdrawPending === pendingApp.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
                    >
                      {withdrawPending === pendingApp.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3" />
                      )}
                      撤回申请
                    </button>
                  </div>
                )}
                {opc.listingStatus === "pending" && !pendingApp && (
                  <div className="mt-3 border-t border-border/50 pt-3">
                    <span className="text-xs text-amber-600">
                      ⏳ 上架申请审核中，请耐心等待管理员审核
                    </span>
                  </div>
                )}
                {/* 驳回提示：管理员驳回后，OPC 回到 private 状态，此处展示驳回原因 */}
                {rejectedApp && opc.listingStatus === "private" && (
                  <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2">
                        <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                        <div>
                          <p className="text-xs font-medium text-destructive">
                            上架申请已被驳回
                          </p>
                          {rejectedApp.rejectReason && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              驳回原因：{rejectedApp.rejectReason}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            可修改后重新申请上架。
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => dismissRejected(opc.id)}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted"
                        title="关闭提示"
                      >
                        <XCircle className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 收益明细 */}
      {!isEnterprise && tab === "revenue" && (
        <div className="table-wrapper rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs text-muted-foreground">
                <th className="whitespace-nowrap px-4 py-3">OPC</th>
                <th className="whitespace-nowrap px-4 py-3">订阅企业</th>
                <th className="whitespace-nowrap px-4 py-3">订单金额</th>
                <th className="whitespace-nowrap px-4 py-3">分成比例</th>
                <th className="whitespace-nowrap px-4 py-3">收益</th>
                <th className="whitespace-nowrap px-4 py-3">时间</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {revenueList.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    暂无收益记录
                  </td>
                </tr>
              )}
              {revenueList.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 text-foreground">{r.agentName}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.enterpriseName || "-"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatYuan(r.orderAmount)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {r.revenuePercent}%
                  </td>
                  <td className="px-4 py-3 font-medium text-green-600">
                    {formatYuan(r.revenueAmount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
