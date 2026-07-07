import { auth } from "@/app/(auth)/auth";
import { deleteAllGuestUsers } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isAdmin } from "@/lib/utils";

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new ChatbotError("unauthorized:users");
    }
    if (!isAdmin(session.user)) {
      throw new ChatbotError("forbidden:users");
    }

    const result = await deleteAllGuestUsers();
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) {
      return err.toResponse();
    }
    return new ChatbotError("bad_request:users").toResponse();
  }
}
