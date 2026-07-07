import { auth } from "@/app/(auth)/auth";
import { getDashboardStats } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isAdmin } from "@/lib/utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new ChatbotError("unauthorized:stats");
    }
    if (!isAdmin(session.user)) {
      throw new ChatbotError("forbidden:stats");
    }

    const stats = await getDashboardStats();
    return Response.json(stats, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) {
      return err.toResponse();
    }
    return new ChatbotError("bad_request:stats").toResponse();
  }
}
