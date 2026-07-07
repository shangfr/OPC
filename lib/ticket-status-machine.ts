/**
 * 工单状态机配置
 *
 * 定义合法的状态流转路径，防止非法跳转（如从"已完成"直接跳回"待处理"）。
 * 产品角度：规范工单生命周期，避免状态混乱。
 */

export type TicketStatus = "pending" | "in_progress" | "completed" | "closed";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type TicketReviewStatus = "pending" | "approved" | "rejected";

/**
 * 合法的状态流转映射
 * key = 当前状态，value = 可流转到的目标状态列表
 */
export const STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  pending: ["in_progress", "completed", "closed"],
  in_progress: ["pending", "completed", "closed"],
  completed: ["in_progress", "closed"],
  closed: ["pending"], // 已关闭的工单可重新打开为待处理
};

/**
 * 合法的审核状态流转映射
 * - pending → approved / rejected（首次审核）
 * - approved → pending（管理员撤回发布，需重新审核）
 * - rejected → pending（用户修改后重新提交审核）
 * 已审核状态之间不可直接跳转，必须先回到 pending
 */
export const REVIEW_TRANSITIONS: Record<TicketReviewStatus, TicketReviewStatus[]> = {
  pending: ["approved", "rejected"],
  approved: ["pending"],
  rejected: ["pending"],
};

/**
 * 检查状态流转是否合法
 */
export function isValidStatusTransition(
  from: TicketStatus,
  to: TicketStatus
): boolean {
  if (from === to) return true; // 相同状态允许（无变更）
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * 检查审核状态流转是否合法
 */
export function isValidReviewTransition(
  from: TicketReviewStatus,
  to: TicketReviewStatus
): boolean {
  if (from === to) return false; // 审核状态相同视为无意义操作
  return REVIEW_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * 获取某状态的下一个合法状态列表（用于前端下拉选项过滤）
 */
export function getNextStatuses(current: TicketStatus): TicketStatus[] {
  return STATUS_TRANSITIONS[current] ?? [];
}

/**
 * 获取某审核状态的下一个合法审核状态列表
 */
export function getNextReviewStatuses(
  current: TicketReviewStatus
): TicketReviewStatus[] {
  return REVIEW_TRANSITIONS[current] ?? [];
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  pending: "待处理",
  in_progress: "进行中",
  completed: "已完成",
  closed: "已关闭",
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};

export const REVIEW_STATUS_LABELS: Record<TicketReviewStatus, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已驳回",
};
