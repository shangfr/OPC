import { getAllOrders } from "@/lib/db/queries";

/**
 * 管理员后台：订单流水页。
 */
export default async function AdminOrdersPage() {
  const orders = await getAllOrders({ limit: 100 });

  const paymentStatusText: Record<string, string> = {
    pending: "待支付",
    paid: "已支付",
    refunded: "已退款",
    failed: "失败",
  };

  return (
    <div className="page-container pb-tabbar">
      <h1 className="page-title">订单流水</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        全平台 OPC 订阅订单记录。
      </p>

      <div className="table-wrapper mt-6 rounded-lg border border-border">
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
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  暂无订单
                </td>
              </tr>
            )}
            {orders.map((o) => (
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
