import { auth } from "@/app/(auth)/auth";
import { getTicketActivities } from "@/lib/db/queries";
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
    const activities = await getTicketActivities({ ticketId: id });
    return Response.json(activities, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}
