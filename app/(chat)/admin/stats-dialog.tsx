"use client";

import { BarChart3, Bot, MessageSquare, ThumbsUp, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface DashboardStats {
  overview: {
    totalChats: number;
    totalUsers: number;
    totalAgents: number;
    activeAgents: number;
    totalMessages: number;
    totalUpvotes: number;
    totalDownvotes: number;
  };
  periods: {
    todayChats: number;
    weekChats: number;
    monthChats: number;
    todayUsers: number;
    weekUsers: number;
    monthUsers: number;
  };
  agentStats: Array<{
    agentName: string;
    chatCount: number;
    messageCount: number;
    upvotes: number;
    downvotes: number;
  }>;
}

const colorMap: Record<string, { bg: string; icon: string }> = {
  cyan: { bg: "bg-sky-500/10", icon: "text-sky-500" },
  orange: { bg: "bg-orange-500/10", icon: "text-orange-500" },
  amber: { bg: "bg-amber-500/10", icon: "text-amber-500" },
  green: { bg: "bg-emerald-500/10", icon: "text-emerald-500" },
};

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  const c = colorMap[color] ?? colorMap.cyan;
  return (
    <Card className="flex items-center gap-4" padding="md" variant="base">
      {Icon && (
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${c.bg}`}
        >
          <Icon className={`size-4 ${c.icon}`} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-lg font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        {sub && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
        )}
      </div>
    </Card>
  );
}

function PeriodCard({
  label,
  chats,
  users,
}: {
  label: string;
  chats: number;
  users: number;
}) {
  return (
    <Card className="rounded-lg bg-muted/30" padding="sm" variant="base">
      <div className="mb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className="flex items-baseline gap-3">
        <span className="text-lg font-semibold">{chats}</span>
        <span className="text-[10px] text-muted-foreground">对话</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-sm font-medium">{users}</span>
        <span className="text-[10px] text-muted-foreground">用户</span>
      </div>
    </Card>
  );
}

const defaultPeriods = {
  todayChats: 0,
  weekChats: 0,
  monthChats: 0,
  todayUsers: 0,
  weekUsers: 0,
  monthUsers: 0,
};

export function StatsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setStats(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const { overview, periods = defaultPeriods, agentStats = [] } = stats ?? {};
  const totalVotes =
    (overview?.totalUpvotes ?? 0) + (overview?.totalDownvotes ?? 0);
  const satisfactionRate =
    totalVotes > 0
      ? Math.round(((overview?.totalUpvotes ?? 0) / totalVotes) * 100)
      : null;

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="w-[90vw] sm:max-w-[1200px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="size-4" />
            数据看板
          </DialogTitle>
          <DialogDescription>
            查看平台使用情况和各 OPC 的表现数据
          </DialogDescription>
        </DialogHeader>

        {loading && !stats ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            加载数据中...
          </div>
        ) : overview ? (
          <div className="space-y-5 py-2">
            {/* 概览卡片 — 与首页统计卡片同风格 */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                color="cyan"
                icon={MessageSquare}
                label="总对话数"
                sub={`${overview.totalMessages} 条消息`}
                value={overview.totalChats}
              />
              <StatCard
                color="orange"
                icon={Users}
                label="注册用户"
                value={overview.totalUsers}
              />
              <StatCard
                color="green"
                icon={Bot}
                label="活跃 OPC"
                sub={`共 ${overview.totalAgents} 个`}
                value={overview.activeAgents}
              />
              <StatCard
                color="amber"
                icon={ThumbsUp}
                label="用户满意度"
                sub={
                  totalVotes > 0
                    ? `${overview.totalUpvotes} 好评 / ${overview.totalDownvotes} 差评`
                    : "暂无投票"
                }
                value={satisfactionRate !== null ? `${satisfactionRate}%` : "—"}
              />
            </div>

            {/* 时段对比 */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                时段对比
              </p>
              <div className="grid grid-cols-3 gap-2">
                <PeriodCard
                  chats={periods.todayChats}
                  label="今日"
                  users={periods.todayUsers}
                />
                <PeriodCard
                  chats={periods.weekChats}
                  label="近 7 天"
                  users={periods.weekUsers}
                />
                <PeriodCard
                  chats={periods.monthChats}
                  label="近 30 天"
                  users={periods.monthUsers}
                />
              </div>
            </div>

            {/* OPC 使用排行 */}
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                OPC 使用排行
              </p>
              <Card
                className="overflow-hidden border-border/50"
                padding="none"
                variant="base"
              >
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 text-left font-medium">
                        OPC 名称
                      </th>
                      <th className="px-3 py-2 text-right font-medium">对话</th>
                      <th className="px-3 py-2 text-right font-medium">消息</th>
                      <th className="px-3 py-2 text-right font-medium">
                        满意度
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentStats.length === 0 ? (
                      <tr>
                        <td
                          className="px-3 py-6 text-center text-xs text-muted-foreground"
                          colSpan={4}
                        >
                          暂无数据
                        </td>
                      </tr>
                    ) : (
                      agentStats.map((row) => {
                        const votes = row.upvotes + row.downvotes;
                        const rate =
                          votes > 0
                            ? Math.round((row.upvotes / votes) * 100)
                            : null;
                        const hasData = row.chatCount > 0;
                        return (
                          <tr
                            className={`border-b border-border/20 last:border-0 ${
                              hasData ? "" : "opacity-40"
                            }`}
                            key={row.agentName}
                          >
                            <td className="px-3 py-2 font-medium">
                              {row.agentName}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {row.chatCount}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {row.messageCount}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {rate !== null ? (
                                <div className="flex items-center justify-end gap-1.5">
                                  <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                                    <div
                                      className={`h-full rounded-full ${
                                        rate >= 60
                                          ? "bg-emerald-500"
                                          : rate >= 40
                                            ? "bg-amber-500"
                                            : "bg-red-500"
                                      }`}
                                      style={{ width: `${rate}%` }}
                                    />
                                  </div>
                                  <span className="text-[11px] tabular-nums">
                                    {rate}%
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">
                                  —
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </Card>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-muted-foreground">
            暂无数据
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
