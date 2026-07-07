import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBaseDetail,
  getKnowledgeUsage,
  listKnowledgeBases,
} from "@/lib/ai/zhipu-knowledge";
import {
  checkUserKnowledgeOwnership,
  createUserKnowledgeRecord,
  deleteUserKnowledgeRecord,
  getUserKnowledgeBases,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isAdmin } from "@/lib/utils";

const createSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(64, "名称最长 64 个字符"),
  embeddingId: z.number().int().optional(), // 3=Embedding-2, 11=Embedding-3, 12=Embedding-3-pro
  description: z.string().max(256).optional(),
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
 * GET /api/knowledge — 列出知识库
 * - 管理员：列出所有知识库 + 用量信息
 * - 普通用户：仅列出自己创建的知识库
 *
 * GET /api/knowledge?id=xxx — 获取单个知识库详情（实时统计）
 * - 管理员：可查看任意知识库
 * - 普通用户：仅可查看自己创建的知识库
 */
export async function GET(request: Request) {
  try {
    const session = await checkAuth();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const admin = isAdmin(session.user);

    // Single KB detail (real-time stats)
    if (id) {
      // 普通用户只能查看自己的知识库
      if (!admin) {
        const owns = await checkUserKnowledgeOwnership(session.user.id, id);
        if (!owns) {
          throw new ChatbotError("forbidden:agent");
        }
      }

      const result = await getKnowledgeBaseDetail(id);
      if (result.code !== 200) {
        return Response.json(
          { error: result.message },
          { status: 502 }
        );
      }
      return Response.json(result.data, { status: 200 });
    }

    // 管理员：列出所有知识库 + 用量信息
    if (admin) {
      const [result, usageResult] = await Promise.all([
        listKnowledgeBases(1, 100),
        getKnowledgeUsage(),
      ]);

      if (result.code !== 200) {
        return Response.json(
          { error: result.message },
          { status: 502 }
        );
      }

      return Response.json(
        {
          ...result.data,
          usage: usageResult.code === 200 ? usageResult.data : null,
        },
        { status: 200 }
      );
    }

    // 普通用户：仅列出自己创建的知识库
    const userKbs = await getUserKnowledgeBases({ userId: session.user.id });

    // 批量获取每个知识库的详情（文档数量等）
    const detailedKbs = await Promise.all(
      userKbs.map(async (ukb) => {
        try {
          const detail = await getKnowledgeBaseDetail(ukb.knowledgeId);
          if (detail.code === 200 && detail.data) {
            return {
              ...detail.data,
              localId: ukb.id,
              name: ukb.name || detail.data.name,
              description: ukb.description || detail.data.description,
            };
          }
          return {
            id: ukb.knowledgeId,
            name: ukb.name,
            description: ukb.description ?? "",
            document_size: 0,
            length: 0,
            word_num: 0,
            localId: ukb.id,
          };
        } catch {
          return {
            id: ukb.knowledgeId,
            name: ukb.name,
            description: ukb.description ?? "",
            document_size: 0,
            length: 0,
            word_num: 0,
            localId: ukb.id,
          };
        }
      })
    );

    return Response.json(
      {
        total: detailedKbs.length,
        list: detailedKbs,
      },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    console.error("[knowledge] list error:", err);
    return new ChatbotError("bad_request:api").toResponse();
  }
}

/**
 * POST /api/knowledge — 创建知识库
 * - 管理员：创建公共知识库（不记录到 UserKnowledge）
 * - 普通用户：创建私有知识库（记录到 UserKnowledge）
 */
export async function POST(request: Request) {
  try {
    const session = await checkAuth();
    const admin = isAdmin(session.user);

    let body: z.infer<typeof createSchema>;
    try {
      body = createSchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:api",
        "请求数据格式不正确"
      ).toResponse();
    }

    const result = await createKnowledgeBase({
      name: body.name,
      embedding_id: body.embeddingId,
      description: body.description,
    });

    if (result.code !== 200) {
      return Response.json(
        { error: result.message },
        { status: 502 }
      );
    }

    // 普通用户：记录到 UserKnowledge 表
    if (!admin && result.data) {
      await createUserKnowledgeRecord({
        userId: session.user.id,
        knowledgeId: result.data.id,
        name: body.name,
        description: body.description,
      });
    }

    return Response.json(result.data, { status: 201 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    console.error("[knowledge] create error:", err);
    return new ChatbotError("bad_request:api").toResponse();
  }
}

/**
 * DELETE /api/knowledge?id=xxx — 删除知识库
 * - 管理员：可删除任意知识库
 * - 普通用户：仅可删除自己创建的知识库
 */
export async function DELETE(request: Request) {
  try {
    const session = await checkAuth();
    const admin = isAdmin(session.user);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new ChatbotError("bad_request:api", "缺少参数 id").toResponse();
    }

    // 普通用户：检查所有权
    if (!admin) {
      const owns = await checkUserKnowledgeOwnership(session.user.id, id);
      if (!owns) {
        throw new ChatbotError("forbidden:agent");
      }
    }

    const result = await deleteKnowledgeBase(id);

    if (result.code !== 200) {
      return Response.json(
        { error: result.message },
        { status: 502 }
      );
    }

    // 删除本地关联记录
    await deleteUserKnowledgeRecord({ userId: session.user.id, knowledgeId: id });

    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    console.error("[knowledge] delete error:", err);
    return new ChatbotError("bad_request:api").toResponse();
  }
}
