/**
 * 套餐驱动型限流配置
 *
 * 套餐级配额由 team.maxMessages 管理，此处仅做小时级防刷限流。
 */

/**
 * 套餐驱动型限流：根据用户套餐返回小时级限流上限
 * - Free: 20条/小时（防刷，月配额100条）
 * - Creator: 50条/小时
 * - Team: 100条/小时
 * - Enterprise: 200条/小时
 * - 管理员: 不限
 */
export function getMaxMessagesPerHour(planName: string | null | undefined, isAdmin: boolean): number {
  if (isAdmin) return 999999;
  switch (planName) {
    case "free":
      return 20;
    case "creator":
      return 50;
    case "team":
      return 100;
    case "enterprise":
      return 200;
    default:
      return 20;
  }
}
