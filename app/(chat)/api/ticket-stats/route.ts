import { auth } from "@/app/(auth)/auth";
import { getTicketStats } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new ChatbotError("unauthorized:ticket");
    }
    const stats = await getTicketStats();
    return Response.json(stats, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket").toResponse();
  }
}
