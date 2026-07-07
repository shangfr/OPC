import { auth } from "@/app/(auth)/auth";
import {
  getDocumentsByUserId,
  deleteDocumentById,
} from "@/lib/db/queries";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const documents = await getDocumentsByUserId({ userId: session.user.id });

  return Response.json({ documents });
}

export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "id required" }, { status: 400 });
  }

  await deleteDocumentById({ id, userId: session.user.id });

  return Response.json({ success: true });
}
