import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { reviewEnterpriseVerification } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

/**
 * 管理员审核企业资质认证。
 * POST /api/admin/enterprises/review
 * body: { enterpriseId, decision: "verified" | "rejected", rejectReason? }
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatbotError("unauthorized:api").toResponse();
    }
    if (session.user.role !== "admin") {
      return new ChatbotError("forbidden:api", "需要管理员权限").toResponse();
    }

    const { enterpriseId, decision, rejectReason } = (await req.json()) as {
      enterpriseId: string;
      decision: "verified" | "rejected";
      rejectReason?: string;
    };

    if (!enterpriseId || !decision) {
      return new ChatbotError("bad_request:api", "参数缺失").toResponse();
    }

    await reviewEnterpriseVerification({
      enterpriseId,
      reviewerId: session.user.id,
      decision,
      rejectReason,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ChatbotError) return error.toResponse();
    return NextResponse.json({ error: "操作失败" }, { status: 500 });
  }
}
