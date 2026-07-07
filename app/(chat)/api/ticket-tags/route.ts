import { auth } from "@/app/(auth)/auth";
import {
  createTicketTag,
  deleteTicketTag,
  getTicketTags,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new ChatbotError("unauthorized:ticket");
    }
    const tags = await getTicketTags();
    return Response.json(tags, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new ChatbotError("unauthorized:ticket");
    }
    const body = (await request.json()) as {
      name?: unknown;
      color?: unknown;
    };
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return new ChatbotError(
        "bad_request:ticket",
        "标签名称不能为空。"
      ).toResponse();
    }
    const result = await createTicketTag({
      name: body.name.trim().slice(0, 32),
      color: typeof body.color === "string" ? body.color : "#6366f1",
      userId: session.user.id,
    });
    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new ChatbotError("unauthorized:ticket");
    }
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return new ChatbotError(
        "bad_request:ticket",
        "缺少参数 id"
      ).toResponse();
    }
    const result = await deleteTicketTag({ id });
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}
