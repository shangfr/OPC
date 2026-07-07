import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createAgent,
  deleteAgent,
  getAgentById,
  getAgents,
  getAgentsByUserId,
  getAgentsByEnterprise,
  getVisibleAgents,
  invalidateAgentCache,
  updateAgent,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isAdmin } from "@/lib/utils";

// 引入校验知识库归属权的方法
import { checkUserKnowledgeOwnership } from "@/lib/db/queries";

const agentSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(64, "名称最长 64 个字符"),
  description: z
    .string()
    .min(1, "描述不能为空")
    .max(512, "描述最长 512 个字符"),
  avatar: z.string().default("/icon.png"),
  systemPrompt: z.string().min(1, "系统提示词不能为空"),
  phone: z.string().max(20, "手机号最长 20 个字符").nullable().default(null),
  knowledgeId: z
    .string()
    .max(64, "知识库 ID 最长 64 个字符")
    .nullable()
    .default(null),
  starterQuestions: z.array(z.string()).max(8, "默认问题最多 8 个").default([]),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  categoryId: z.string().uuid().nullable().default(null),
  // 可见性：public=全站可见（仅管理员可创建），private=仅创建者可见（普通用户可创建）
  visibility: z.enum(["public", "private"]).default("public"),
  // OPC 交易市场：订阅价格（分），0=免费
  priceMonthly: z.number().int().min(0).default(0),
  priceYearly: z.number().int().min(0).default(0),
});

async function checkAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new ChatbotError("unauthorized:agent");
  }
  return session;
}

async function checkAdmin() {
  const session = await checkAuth();
  if (!isAdmin(session.user)) {
    throw new ChatbotError("forbidden:agent");
  }
  return session;
}

/**
 * 检查用户是否有权操作指定 Agent
 * - 平台管理员：可操作所有 Agent
 * - 企业团队管理员（owner/admin）：可操作本团队创建的 OPC
 * - 普通用户：仅可操作自己创建的 private Agent
 */
async function checkAgentOwnership(agentId: string, userId: string) {
  const existing = await getAgentById({ id: agentId });
  if (!existing) {
    throw new ChatbotError("not_found:agent");
  }

  const session = await auth();
  // 平台管理员可操作所有
  if (session?.user && isAdmin(session.user)) {
    return existing;
  }

  // 企业团队管理员可操作本企业 OPC（含团队创建的 + 订阅副本）
  const accountType = (session?.user?.accountType as string) ?? "personal";
  const teamRole = (session?.user?.teamRole as string) ?? null;
  if (
    accountType === "enterprise" &&
    (teamRole === "owner" || teamRole === "admin") &&
    existing.ownerEnterpriseId &&
    existing.ownerEnterpriseId === session?.user?.enterpriseId
  ) {
    return existing;
  }

  // 普通用户仅可操作自己创建的 private Agent
  if (existing.userId !== userId || existing.visibility !== "private") {
    throw new ChatbotError("forbidden:agent");
  }

  return existing;
}

export async function GET(request: Request) {
  try {
    const session = await checkAuth();
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope"); // "mine" = 仅自己创建的

    const accountType = (session.user.accountType as "personal" | "enterprise") ?? "personal";
    const teamRole = (session.user.teamRole as "owner" | "admin" | "member" | null) ?? null;
    const isEnterpriseAdmin = accountType === "enterprise" && (teamRole === "owner" || teamRole === "admin");

    let agents;
    if (scope === "mine") {
      // 企业账号：返回本企业全部 OPC（含团队创建 + 订阅副本）
      if (accountType === "enterprise" && session.user.enterpriseId) {
        agents = await getAgentsByEnterprise(session.user.enterpriseId);
      } else {
        agents = await getAgentsByUserId({ userId: session.user.id });
      }
    } else if (isAdmin(session.user)) {
      // 平台管理员：返回所有 OPC
      agents = await getAgents();
    } else if (isEnterpriseAdmin && session.user.teamId) {
      // 企业团队管理员：返回团队 OPC + 可见的公共 OPC
      agents = await getVisibleAgents({
        userId: session.user.id,
        teamId: session.user.teamId,
        accountType,
        enterpriseId: session.user.enterpriseId ?? null,
        teamRole,
      });
    } else {
      agents = await getVisibleAgents({
        userId: session.user.id,
        teamId: session.user.teamId ?? null,
        accountType,
        enterpriseId: session.user.enterpriseId ?? null,
        teamRole,
      });
    }

    return Response.json(agents, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:agent").toResponse();
  }
}

export async function POST(request: Request) {
  try {
    const session = await checkAuth();
    let body: z.infer<typeof agentSchema>;

    try {
      body = agentSchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:agent",
        "请求数据格式不正确。请检查后重试。"
      ).toResponse();
    }

    // 权限校验：普通用户只能创建 private OPC，不能创建 public OPC
    const userIsAdmin = isAdmin(session.user);
    const visibility = userIsAdmin ? body.visibility : "private";

    // 普通用户不能设置 isDefault
    const isDefault = userIsAdmin ? body.isDefault : false;

    // 🚨 新增：普通用户绑定知识库时，校验是否属于自己的
    if (!userIsAdmin && body.knowledgeId) {
      const owns = await checkUserKnowledgeOwnership(
        session.user.id,
        body.knowledgeId
      );
      if (!owns) {
        return new ChatbotError(
          "forbidden:agent",
          "无权使用该知识库"
        ).toResponse();
      }
    }

    // OPC 交易市场：按账号类型设定所有权
    // - 个人账号 → personal_private（ownerType=user）
    // - 企业账号 → enterprise_private（ownerType=enterprise, ownerEnterpriseId=当前企业）
    // - 管理员 → 可创建 public（ownerType=platform），由 body.ownershipType 指定
    const accountType = (session.user.accountType as "personal" | "enterprise") ?? "personal";
    const ownershipType =
      userIsAdmin && body.visibility === "public"
        ? "public"
        : accountType === "enterprise"
          ? "enterprise_private"
          : "personal_private";
    const ownerType: "user" | "enterprise" | "platform" =
      ownershipType === "public" ? "platform" : ownershipType === "enterprise_private" ? "enterprise" : "user";

    const result = await createAgent({
      name: body.name,
      description: body.description,
      avatar: body.avatar,
      systemPrompt: body.systemPrompt,
      phone: body.phone,
      knowledgeId: body.knowledgeId,
      starterQuestions: body.starterQuestions,
      isActive: body.isActive,
      isDefault,
      sortOrder: body.sortOrder,
      categoryId: body.categoryId,
      userId: session.user.id,
      visibility,
      // SaaS 多租户：private OPC 归属当前团队
      teamId: session.user.teamId ?? null,
      // OPC 交易市场：所有权字段
      ownershipType,
      ownerType,
      ownerEnterpriseId: session.user.enterpriseId ?? null,
      priceMonthly: body.priceMonthly ?? 0,
      priceYearly: body.priceYearly ?? 0,
    });

    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:agent").toResponse();
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await checkAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new ChatbotError("bad_request:agent", "缺少参数 id").toResponse();
    }

    // 检查所有权
    const existing = await checkAgentOwnership(id, session.user.id);

    let body: Partial<z.infer<typeof agentSchema>>;
    try {
      body = await request.json();
    } catch {
      return new ChatbotError(
        "bad_request:agent",
        "请求数据格式不正确"
      ).toResponse();
    }

    // 普通用户不能修改 visibility 和 isDefault
    const userIsAdmin = isAdmin(session.user);
    if (!userIsAdmin) {
      delete body.visibility;
      delete body.isDefault;
    }

    // 🚨 新增：普通用户修改知识库时，校验是否属于自己的
    if (!userIsAdmin && body.knowledgeId !== undefined && body.knowledgeId !== null) {
      const owns = await checkUserKnowledgeOwnership(
        session.user.id,
        body.knowledgeId
      );
      if (!owns) {
        return new ChatbotError(
          "forbidden:agent",
          "无权使用该知识库"
        ).toResponse();
      }
    }

    const result = await updateAgent({
      id,
      name: body.name ?? existing.name,
      description: body.description ?? existing.description,
      avatar: body.avatar ?? existing.avatar,
      systemPrompt: body.systemPrompt ?? existing.systemPrompt,
      phone: body.phone !== undefined ? body.phone : existing.phone,
      knowledgeId: body.knowledgeId !== undefined ? body.knowledgeId : existing.knowledgeId,
      starterQuestions: body.starterQuestions ?? existing.starterQuestions ?? [],
      isActive: body.isActive ?? existing.isActive,
      isDefault: body.isDefault,
      sortOrder: body.sortOrder ?? existing.sortOrder,
      categoryId: body.categoryId !== undefined ? body.categoryId : existing.categoryId,
      visibility: body.visibility ?? existing.visibility,
    });

    invalidateAgentCache(id);
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:agent").toResponse();
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await checkAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new ChatbotError("bad_request:agent", "缺少参数 id").toResponse();
    }

    // 检查所有权
    await checkAgentOwnership(id, session.user.id);

    const result = await deleteAgent({ id });
    invalidateAgentCache(id);
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:agent").toResponse();
  }
}
