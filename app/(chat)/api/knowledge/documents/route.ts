import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  deleteDocument,
  listDocuments,
  uploadDocument,
} from "@/lib/ai/zhipu-knowledge";
import { checkUserKnowledgeOwnership } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isAdmin } from "@/lib/utils";

async function checkAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new ChatbotError("unauthorized:agent");
  }
  return session;
}

/**
 * 检查用户是否有权操作指定知识库
 * - 管理员：始终通过
 * - 普通用户：必须拥有该知识库
 */
async function checkKnowledgeAccess(
  knowledgeId: string,
  userId: string,
  admin: boolean
) {
  if (admin) return;
  const owns = await checkUserKnowledgeOwnership(userId, knowledgeId);
  if (!owns) {
    throw new ChatbotError("forbidden:agent");
  }
}

/**
 * GET /api/knowledge/documents?knowledgeId=xxx — 列出知识库中的文档
 */
export async function GET(request: Request) {
  try {
    const session = await checkAuth();
    const admin = isAdmin(session.user);
    const { searchParams } = new URL(request.url);
    const knowledgeId = searchParams.get("knowledgeId");
    const page = Number(searchParams.get("page") ?? 1);
    const size = Number(searchParams.get("size") ?? 50);

    if (!knowledgeId) {
      return new ChatbotError(
        "bad_request:api",
        "缺少参数 knowledgeId"
      ).toResponse();
    }

    await checkKnowledgeAccess(knowledgeId, session.user.id, admin);

    const result = await listDocuments(knowledgeId, page, size);

    if (result.code !== 200) {
      return Response.json(
        { error: result.message },
        { status: 502 }
      );
    }

    return Response.json(result.data, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    console.error("[knowledge-docs] list error:", err);
    return new ChatbotError("bad_request:api").toResponse();
  }
}

/**
 * POST /api/knowledge/documents — 上传文档到知识库
 * Content-Type: multipart/form-data
 * Body: knowledgeId (string), files (File[])
 */
export async function POST(request: Request) {
  try {
    const session = await checkAuth();
    const admin = isAdmin(session.user);

    const formData = await request.formData();
    const knowledgeId = formData.get("knowledgeId");
    const knowledgeType = formData.get("knowledgeType");
    const sentenceSize = formData.get("sentenceSize");

    if (!knowledgeId || typeof knowledgeId !== "string") {
      return new ChatbotError(
        "bad_request:api",
        "缺少参数 knowledgeId"
      ).toResponse();
    }

    await checkKnowledgeAccess(knowledgeId, session.user.id, admin);

    const files = formData.getAll("files").filter(
      (f): f is File => f instanceof File
    );

    if (files.length === 0) {
      return new ChatbotError(
        "bad_request:api",
        "未选择任何文件"
      ).toResponse();
    }

    // Upload files one by one (ZhiPu API accepts single file per request)
    const allSuccess: Array<{ documentId: string; fileName: string }> = [];
    const allFailed: Array<{ fileName: string; failReason: string }> = [];

    // Auto-detect knowledge_type from file extension when not specified
    const knowledgeTypeByExt = (filename: string): number | undefined => {
      if (knowledgeType) return Number(knowledgeType);
      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      // txt, doc, pdf, docx, ppt, pptx, md → 按标题段落切片
      if (["txt", "doc", "pdf", "docx", "ppt", "pptx", "md"].includes(ext)) {
        return 1;
      }
      // xls, xlsx, csv → 按行切片
      if (["xls", "xlsx", "csv"].includes(ext)) {
        return 3;
      }
      return undefined; // let ZhiPu auto-detect for unknown types
    };

    for (const file of files) {
      try {
        const result = await uploadDocument(knowledgeId, file, {
          knowledge_type: knowledgeTypeByExt(file.name),
          sentence_size: sentenceSize ? Number(sentenceSize) : undefined,
        });

        if (result.code === 200 && result.data) {
          allSuccess.push(...result.data.successInfos);
          allFailed.push(...result.data.failedInfos);
        } else {
          allFailed.push({
            fileName: file.name,
            failReason: result.message || "上传失败",
          });
        }
      } catch (e) {
        allFailed.push({
          fileName: file.name,
          failReason: e instanceof Error ? e.message : "未知错误",
        });
      }
    }

    return Response.json(
      { successInfos: allSuccess, failedInfos: allFailed },
      { status: 200 }
    );
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    console.error("[knowledge-docs] upload error:", err);
    return new ChatbotError("bad_request:api").toResponse();
  }
}

/**
 * DELETE /api/knowledge/documents?id=xxx&knowledgeId=yyy — 删除文档
 * 普通用户需提供 knowledgeId 以验证所有权
 */
export async function DELETE(request: Request) {
  try {
    const session = await checkAuth();
    const admin = isAdmin(session.user);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const knowledgeId = searchParams.get("knowledgeId");

    if (!id) {
      return new ChatbotError("bad_request:api", "缺少参数 id").toResponse();
    }

    // 普通用户必须提供 knowledgeId 以验证所有权
    if (!admin) {
      if (!knowledgeId) {
        return new ChatbotError(
          "bad_request:api",
          "缺少参数 knowledgeId"
        ).toResponse();
      }
      await checkKnowledgeAccess(knowledgeId, session.user.id, admin);
    }

    const result = await deleteDocument(id);

    if (result.code !== 200) {
      return Response.json(
        { error: result.message },
        { status: 502 }
      );
    }

    return Response.json({ success: true }, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    console.error("[knowledge-docs] delete error:", err);
    return new ChatbotError("bad_request:api").toResponse();
  }
}
