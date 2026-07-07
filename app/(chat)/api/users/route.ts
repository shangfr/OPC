import { auth } from "@/app/(auth)/auth";
import { getUserManagementStats } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isAdmin } from "@/lib/utils";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new ChatbotError("unauthorized:users");
    }
    if (!isAdmin(session.user)) {
      throw new ChatbotError("forbidden:users");
    }

    const stats = await getUserManagementStats();
    return Response.json(stats, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) {
      return err.toResponse();
    }
    return new ChatbotError("bad_request:users").toResponse();
  }
}
