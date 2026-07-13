import Link from "next/link";
import { getAllOrders } from "@/lib/db/queries";

/**
 * 管理员后台：订单流水页。
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams?: { status?: string };
}) {
  const statusFilter = searchParams?.status;
  const orders = await getAllOrders({ limit: 100 });

  // 按状态过滤（支持 paid / pending / refunded / failed）
  const filteredOrders = statusFilter
    ? orders.filter((o) => o.paymentStatus === statusFilter)
    : orders;

  const paymentStatusText: Record<string, string> = {
    pending: "待支付",
    paid: "已支付",
    refunded: "已退款",
    failed: "失败",
  };

  // 汇总统计：总订单数与已支付金额
  const totalPaid = orders
    .filter((o) => o.paymentStatus === "paid")
    .reduce((sum, o) => sum + Number(o.amount), 0);

  const statusTabs = [
    { key: "", label: "全部", count: orders.length },
    { key: "paid", label: "已支付", count: orders.filter((o) => o.paymentStatus === "paid").length },
    { key: "pending", label: "待支付", count: orders.filter((o) => o.paymentStatus === "pending").length },
    { key: "refunded", label: "已退款", count: orders.filter((o) => o.paymentStatus === "refunded").length },
    { key: "failed", label: "失败", count: orders.filter((o) => o.paymentStatus === "failed").length },
  ];

  return (
    <div className="page-container pb-tabbar">
      <h1 className="page-title">订单流水</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        全平台 OPC 订阅订单记录。
      </p>

      {/* 汇总卡片 */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            订单总数
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{orders.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            已支付金额
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            ¥{(totalPaid / 100).toFixed(2)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            当前筛选
          </p>
          <p className="mt-1 text-lg font-semibold tabular-nums">
            {filteredOrders.length}
          </p>
        </div>
      </div>

      {/* 状态筛选标签 */}
      <div className="mt-4 flex flex-wrap gap-2">
        {statusTabs.map((tab) => {
          const active = (tab.key || "") === (statusFilter || "");
          return (
            <Link
              key={tab.key || "all"}
              href={tab.key ? `/admin/orders?status=${tab.key}` : "/admin/orders"}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent"
              }`}
            >
              {tab.label}
              <span className={`rounded px-1 text-[10px] ${active ? "bg-primary-foreground/20" : "bg-muted"}`}>
                {tab.count}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="table-wrapper mt-4 rounded-lg border border-border">
        <table className="table-to-card w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-left">订单号</th>
              <th className="whitespace-nowrap px-4 py-3 text-left">OPC</th>
              <th className="whitespace-nowrap px-4 py-3 text-left">订阅企业</th>
              <th className="whitespace-nowrap px-4 py-3 text-left">周期</th>
              <th className="whitespace-nowrap px-4 py-3 text-left">金额</th>
              <th className="whitespace-nowrap px-4 py-3 text-left">状态</th>
              <th className="whitespace-nowrap px-4 py-3 text-left">时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {filteredOrders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  {statusFilter ? `暂无${paymentStatusText[statusFilter] ?? statusFilter}订单` : "暂无订单"}
                </td>
              </tr>
            )}
            {filteredOrders.map((o) => (
              <tr key={o.id}>
                <td data-label="订单号" className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {o.orderNo}
                </td>
                <td data-label="OPC" className="px-4 py-3 text-foreground">{o.agentName}</td>
                <td data-label="订阅企业" className="px-4 py-3 text-muted-foreground">
                  {o.enterpriseName}
                </td>
                <td data-label="周期" className="px-4 py-3 text-muted-foreground">
                  {o.period === "monthly" ? "月度" : "年度"}
                </td>
                <td data-label="金额" className="px-4 py-3 text-foreground">
                  ¥{(Number(o.amount) / 100).toFixed(2)}
                </td>
                <td data-label="状态" className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      o.paymentStatus === "paid"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : o.paymentStatus === "pending"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {paymentStatusText[o.paymentStatus] ?? o.paymentStatus}
                  </span>
                </td>
                <td data-label="时间" className="px-4 py-3 text-xs text-muted-foreground">
                  {new Date(o.createdAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
