"use client";

import { useState, useMemo } from "react";
import { Loader2, AlertTriangle, RotateCcw, Search } from "lucide-react";
import { toast } from "@/components/chat/toast";

type Opc = {
  id: string;
  name: string;
  listingStatus: string;
  priceMonthly: number;
  priceYearly: number;
  listedAt: string | null;
  delistedAt: string | null;
  delistReason: string | null;
};

const statusText: Record<string, string> = {
  listed: "已上架",
  delisted: "已下架",
  pending: "审核中",
  private: "私有",
};

export function ForceDelistView({ opcs }: { opcs: Opc[] }) {
  const [pending, setPending] = useState<string | null>(null);
  const [delistReasons, setDelistReasons] = useState<Record<string, string>>(
    {}
  );
  const [keyword, setKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredOpcs = useMemo(() => {
    return opcs.filter((o) => {
      const matchKeyword =
        !keyword || o.name.toLowerCase().includes(keyword.toLowerCase());
      const matchStatus =
        statusFilter === "all" || o.listingStatus === statusFilter;
      return matchKeyword && matchStatus;
    });
  }, [opcs, keyword, statusFilter]);

  async function handleForceDelist(opcId: string, name: string) {
    const reason = delistReasons[opcId]?.trim();
    if (!reason) {
      toast({ type: "error", description: "请填写下架原因（便于审计与恢复）" });
      return;
    }
    if (
      !confirm(
        `确认强制下架「${name}」？\n\n下架后：\n• 该 OPC 不再对全站可见，新用户无法发起会话\n• 已订阅企业可继续使用至当前订阅周期结束\n• 可随时在下方点击「恢复上架」重新上架\n\n下架原因：${reason}`
      )
    )
      return;
    setPending(opcId);
    try {
      const res = await fetch("/api/admin/opcs/force-delist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: opcId, reason }),
      });
      if (res.ok) {
        toast({ type: "success", description: "已强制下架" });
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          type: "error",
          description: data.error || "操作失败",
        });
      }
    } finally {
      setPending(null);
    }
  }

  async function handleRestore(opcId: string, name: string) {
    if (
      !confirm(
        `确认恢复上架「${name}」？\n\n恢复后：\n• 该 OPC 重新对全站可见\n• 已订阅企业继续可用\n• 下架审计记录将被清除`
      )
    )
      return;
    setPending(opcId);
    try {
      const res = await fetch("/api/admin/opcs/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: opcId }),
      });
      if (res.ok) {
        toast({ type: "success", description: "已恢复上架" });
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        toast({
          type: "error",
          description: data.error || "操作失败",
        });
      }
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-8 space-y-4">
      {/* 搜索与筛选 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="搜索 OPC 名称..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="all">全部状态</option>
          <option value="listed">已上架</option>
          <option value="delisted">已下架</option>
          <option value="pending">审核中</option>
        </select>
      </div>

      <div className="table-wrapper rounded-lg border border-border">
        <table className="table-to-card w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-left">OPC 名称</th>
              <th className="whitespace-nowrap px-4 py-3 text-left">状态</th>
              <th className="whitespace-nowrap px-4 py-3 text-left">月度价格</th>
              <th className="whitespace-nowrap px-4 py-3 text-left">上架时间</th>
              <th className="whitespace-nowrap px-4 py-3 text-left">下架信息</th>
              <th className="whitespace-nowrap px-4 py-3 text-left">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {filteredOpcs.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  {opcs.length === 0 ? "暂无公共 OPC" : "无匹配的 OPC"}
                </td>
              </tr>
            )}
            {filteredOpcs.map((opc) => (
              <tr key={opc.id}>
                <td data-label="OPC 名称" className="px-4 py-3 font-medium text-foreground">
                  {opc.name}
                </td>
                <td data-label="状态" className="px-4 py-3">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      opc.listingStatus === "listed"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : opc.listingStatus === "delisted"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {statusText[opc.listingStatus] ?? opc.listingStatus}
                  </span>
                </td>
                <td data-label="月度价格" className="px-4 py-3 text-muted-foreground">
                  ¥{(opc.priceMonthly / 100).toFixed(2)}
                </td>
                <td data-label="上架时间" className="px-4 py-3 text-xs text-muted-foreground">
                  {opc.listedAt
                    ? new Date(opc.listedAt).toLocaleDateString()
                    : "-"}
                </td>
                <td data-label="下架信息" className="px-4 py-3 text-xs text-muted-foreground">
                  {opc.listingStatus === "delisted" ? (
                    <div className="space-y-0.5">
                      {opc.delistedAt && (
                        <div>
                          下架时间：
                          {new Date(opc.delistedAt).toLocaleString()}
                        </div>
                      )}
                      {opc.delistReason && (
                        <div className="max-w-[240px] break-words text-destructive">
                          原因：{opc.delistReason}
                        </div>
                      )}
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
                <td data-label="操作" className="px-4 py-3">
                  {opc.listingStatus === "listed" && (
                    <div className="flex flex-col gap-2">
                      <input
                        type="text"
                        placeholder="下架原因（必填）"
                        value={delistReasons[opc.id] ?? ""}
                        onChange={(e) =>
                          setDelistReasons({
                            ...delistReasons,
                            [opc.id]: e.target.value,
                          })
                        }
                        className="w-48 rounded border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
                      />
                      <button
                        onClick={() => handleForceDelist(opc.id, opc.name)}
                        disabled={pending === opc.id}
                        className="flex w-fit items-center gap-1 rounded-lg border border-destructive/30 px-3 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                      >
                        {pending === opc.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <AlertTriangle className="size-3" />
                        )}
                        强制下架
                      </button>
                    </div>
                  )}
                  {opc.listingStatus === "delisted" && (
                    <button
                      onClick={() => handleRestore(opc.id, opc.name)}
                      disabled={pending === opc.id}
                      className="flex items-center gap-1 rounded-lg border border-emerald-500/30 px-3 py-1 text-xs text-emerald-600 hover:bg-emerald-500/10 disabled:opacity-50 dark:text-emerald-400"
                    >
                      {pending === opc.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3" />
                      )}
                      恢复上架
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 说明 */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">下架与恢复说明</p>
        <ul className="mt-2 space-y-1">
          <li>
            • <strong>强制下架</strong>：OPC 转为 delisted
            状态，不再对全站可见，新用户无法发起会话。
          </li>
          <li>
            • <strong>已订阅企业</strong>：可继续使用该 OPC
            至当前订阅周期结束，到期后无法续订。
          </li>
          <li>
            • <strong>恢复上架</strong>：将 delisted 恢复为
            listed，OPC 重新对全站可见，已订阅企业继续可用。
          </li>
          <li>
            • <strong>审计追溯</strong>：下架时记录操作人、时间、原因，便于后续追溯。
          </li>
        </ul>
      </div>
    </div>
  );
}
