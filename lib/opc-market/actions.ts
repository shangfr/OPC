"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/app/(auth)/auth";
import {
  submitListingApplication,
  withdrawListingApplication,
  reviewListingApplication,
  getMyListingApplications,
  getPendingListingApplications,
} from "@/lib/db/queries";
import type { ActionResult } from "@/lib/enterprise/actions";

/**
 * OPC 交易市场：上架/下架申请 Server Actions
 *
 * 流程状态机：
 *   private --list申请--> pending --审核通过--> listed --delist申请--> delisted
 *                          \--驳回--> private        \--驳回--> listed
 *                          \--撤回--> private
 */

/**
 * 提交上架/下架申请（OPC 所有者调用）。
 */
export async function submitListingApplicationAction(input: {
  agentId: string;
  type: "list" | "delist";
  description?: string;
}): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "未登录" };
    }

    await submitListingApplication({
      agentId: input.agentId,
      applicantId: session.user.id,
      type: input.type,
      description: input.description,
    });

    revalidatePath("/creator");
    revalidatePath("/admin");
    return { success: true };
  } catch (e) {
    const err = e as { message?: string; cause?: string };
    return { success: false, error: err.cause || err.message || "提交失败" };
  }
}

/**
 * 撤回申请（申请人调用）。
 */
export async function withdrawListingApplicationAction(
  input: { applicationId: string }
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "未登录" };
    }

    await withdrawListingApplication({
      applicationId: input.applicationId,
      applicantId: session.user.id,
    });

    revalidatePath("/creator");
    revalidatePath("/admin");
    return { success: true };
  } catch (e) {
    // ChatbotError 的 message 是通用文案，真实错误在 cause 里
    const err = e as { message?: string; cause?: string };
    return { success: false, error: err.cause || err.message || "撤回失败" };
  }
}

/**
 * 管理员审核申请（仅 admin 角色可调用）。
 */
export async function reviewListingApplicationAction(input: {
  applicationId: string;
  decision: "approved" | "rejected";
  rejectReason?: string;
}): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "未登录" };
    }
    if (session.user.role !== "admin") {
      return { success: false, error: "无权限：需要管理员角色" };
    }

    await reviewListingApplication({
      applicationId: input.applicationId,
      reviewerId: session.user.id,
      decision: input.decision,
      rejectReason: input.rejectReason,
    });

    revalidatePath("/admin");
    return { success: true };
  } catch (e) {
    return { success: false, error: (e as Error).message };
  }
}

/**
 * 获取当前用户的申请记录（创作者/企业后台用）。
 */
export async function getMyApplicationsAction() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return [];
    }
    return await getMyListingApplications({ applicantId: session.user.id });
  } catch {
    return [];
  }
}

/**
 * 获取待审核申请列表（管理员后台用）。
 */
export async function getPendingApplicationsAction() {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "admin") {
      return [];
    }
    return await getPendingListingApplications();
  } catch {
    return [];
  }
}
