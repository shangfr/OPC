import { NextResponse } from "next/server";
import { listUserTeams, getCurrentTeamId } from "@/lib/auth/team-context";

/**
 * SaaS 多租户：团队列表 API
 * GET /api/teams → 返回当前用户加入的所有团队 + 当前选中的 teamId
 * 供团队切换器下拉菜单使用。
 */
export async function GET() {
  const teams = await listUserTeams();
  const currentTeamId = await getCurrentTeamId();

  return NextResponse.json({
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      planName: t.planName,
      role: t.role,
    })),
    currentTeamId,
  });
}
