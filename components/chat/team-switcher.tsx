"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Users } from "lucide-react";
import useSWR from "swr";
import { switchTeamAction } from "@/lib/teams/actions";
import { toast } from "./toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenuButton,
} from "@/components/ui/sidebar";

const fetcher = (url: string) =>
  fetch(url).then((res) => res.json()) as Promise<{
    teams: { id: string; name: string; planName: string | null; role: string }[];
    currentTeamId: string | null;
  }>;

/**
 * SaaS 多租户：团队切换器
 *
 * 在侧边栏顶部展示当前团队名，点击下拉可切换团队或跳转创建团队。
 * 切换流程：
 *   1. 调用 switchTeamAction 校验成员资格并更新 session token（服务端）
 *   2. router.refresh() 触发服务端组件重新渲染（对话列表按新 teamId 过滤）
 */
export function TeamSwitcher() {
  const router = useRouter();
  const [switching, setSwitching] = useState(false);
  const { data, mutate } = useSWR("/api/teams", fetcher);

  const teams = data?.teams ?? [];
  const currentTeamId = data?.currentTeamId;
  const currentTeam = teams.find((t) => t.id === currentTeamId);

  async function handleSwitch(teamId: string) {
    if (teamId === currentTeamId) return;
    setSwitching(true);
    try {
      const result = await switchTeamAction(teamId);
      if (!result.success) {
        toast({ type: "error", description: result.error ?? "切换失败" });
        return;
      }
      // 重新拉取团队列表 + 刷新页面数据（switchTeamAction 已在服务端更新 token）
      await mutate();
      router.refresh();
      toast({ type: "success", description: "已切换团队" });
    } catch (e) {
      toast({ type: "error", description: "切换团队失败" });
    } finally {
      setSwitching(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          className="h-9 px-2 rounded-lg"
          data-testid="team-switcher"
          disabled={switching}
        >
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Users className="size-3.5" />
          </div>
          <span className="truncate text-[13px] font-medium">
            {currentTeam?.name ?? "选择团队"}
          </span>
          <ChevronsUpDown className="ml-auto size-3.5 text-sidebar-foreground/50" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-(--radix-popper-anchor-width) min-w-56"
        side="bottom"
        align="start"
      >
        <DropdownMenuLabel className="text-[11px] text-muted-foreground">
          我的团队
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {teams.length === 0 && (
          <div className="px-2 py-3 text-center text-xs text-muted-foreground">
            暂无团队
          </div>
        )}
        {teams.map((t) => (
          <DropdownMenuItem
            key={t.id}
            className="cursor-pointer justify-between text-[13px]"
            onSelect={() => handleSwitch(t.id)}
          >
            <div className="flex flex-col">
              <span>{t.name}</span>
              {t.planName && (
                <span className="text-[10px] text-muted-foreground">
                  {t.planName} · {t.role === "owner" ? "所有者" : t.role === "admin" ? "管理员" : "成员"}
                </span>
              )}
            </div>
            {t.id === currentTeamId && (
              <Check className="size-3.5 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer text-[13px]"
          onSelect={() => router.push("/team")}
        >
          <Plus className="mr-2 size-3.5" />
          创建 / 管理团队
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
