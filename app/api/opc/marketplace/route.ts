import { NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getMarketplaceAgents } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

/**
 * OPC 交易市场：商城浏览 API
 * GET /api/opc/marketplace?categoryId=&search=
 *
 * 返回全部已上架公共 OPC（listingStatus=listed），供企业浏览雇佣。
 * 任何登录用户可浏览（个人创作者也可查看市场行情），但仅企业可下单订阅。
 */
export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new ChatbotError("unauthorized:api").toResponse();
    }

    const url = new URL(req.url);
    const categoryId = url.searchParams.get("categoryId") || undefined;
    const search = url.searchParams.get("search") || undefined;

    const agents = await getMarketplaceAgents({
      categoryId: categoryId ?? null,
      search: search ?? null,
    });

    return NextResponse.json({ agents });
  } catch (error) {
    if (error instanceof ChatbotError) {
      return error.toResponse();
    }
    return NextResponse.json(
      { error: "Failed to fetch marketplace agents" },
      { status: 500 }
    );
  }
}
