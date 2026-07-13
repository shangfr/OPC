import { getAllGatewayModels, getCapabilities, isDemo } from "@/lib/ai/models";
import { auth } from "@/app/(auth)/auth";
import { hasPlanTier } from "@/lib/payments/config";

/**
 * 模型列表 API — 套餐驱动型模型可见性
 *
 * - Free: 仅返回基础模型（列表第一个）
 * - Creator+: 返回全部模型
 * - 管理员: 返回全部模型
 */
export async function GET() {
  const session = await auth();
  const userPlan = session?.user?.planName ?? "free";
  const isAdmin = session?.user?.role === "admin";

  const headers = {
    "Cache-Control": "public, max-age=86400, s-maxage=86400",
  };

  const curatedCapabilities = getCapabilities();
  const allModels = getAllGatewayModels();

  // Free 用户仅可见第一个模型（基础模型）
  const visibleModels = (!isAdmin && !hasPlanTier(userPlan, "creator"))
    ? allModels.slice(0, 1)
    : allModels;

  if (isDemo) {
    const capabilities = Object.fromEntries(
      visibleModels.map((m) => [m.id, curatedCapabilities[m.id] ?? m.capabilities])
    );

    return Response.json({ capabilities, models: visibleModels }, { headers });
  }

  // 非 Demo 模式：返回能力映射（仅包含可见模型）
  const filteredCaps: Record<string, typeof curatedCapabilities[string]> = {};
  for (const m of visibleModels) {
    if (curatedCapabilities[m.id]) {
      filteredCaps[m.id] = curatedCapabilities[m.id];
    }
  }

  return Response.json(filteredCaps, { headers });
}
