import { auth } from "@/app/(auth)/auth";
import { getTicketTagIds, setTicketTags } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new ChatbotError("unauthorized:ticket");
    }
    const { id } = await params;
    const tagIds = await getTicketTagIds({ ticketId: id });
    return Response.json(tagIds, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new ChatbotError("unauthorized:ticket");
    }
    const { id } = await params;
    const body = (await request.json()) as { tagIds?: unknown };
    if (!Array.isArray(body.tagIds)) {
      return new ChatbotError(
        "bad_request:ticket",
        "tagIds 必须是字符串数组。"
      ).toResponse();
    }
    const tagIds = body.tagIds.filter((t): t is string => typeof t === "string");
    const result = await setTicketTags({ ticketId: id, tagIds });
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}
