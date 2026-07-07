import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { retrieve } from "@/lib/ai/zhipu-knowledge";
import { ChatbotError } from "@/lib/errors";

const retrieveSchema = z.object({
  query: z.string().min(1).max(1000),
  knowledgeIds: z.array(z.string()).min(1),
  topK: z.number().int().min(1).max(20).optional(),
  recallMethod: z.enum(["embedding", "keyword", "mixed"]).optional(),
});

/**
 * POST /api/knowledge/retrieve — 检索知识库
 * 供前端调试和内部调用
 */
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    let body: z.infer<typeof retrieveSchema>;
    try {
      body = retrieveSchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:api",
        "请求数据格式不正确"
      ).toResponse();
    }

    const result = await retrieve({
      query: body.query,
      knowledge_ids: body.knowledgeIds,
      top_k: body.topK ?? 5,
      recall_method: body.recallMethod ?? "mixed",
    });

    if (result.code !== 200) {
      return Response.json(
        { error: result.message },
        { status: 502 }
      );
    }

    return Response.json(result.data ?? [], { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    console.error("[knowledge-retrieve] error:", err);
    return new ChatbotError("bad_request:api").toResponse();
  }
}
