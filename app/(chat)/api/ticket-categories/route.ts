import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createTicketCategory,
  deleteTicketCategory,
  getTicketCategories,
  getTicketCategoryById,
  updateTicketCategory,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isAdmin } from "@/lib/utils";

const ticketCategorySchema = z.object({
  name: z.string().min(1, "名称不能为空").max(32, "名称最长 32 个字符"),
  color: z.string().default("#6366f1"),
  sortOrder: z.number().int().default(0),
  colorKey: z.string().default("indigo"),
});

async function checkAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new ChatbotError("unauthorized:ticket-category");
  }
  return session;
}

async function checkAdmin() {
  const session = await checkAuth();
  if (!isAdmin(session.user)) {
    throw new ChatbotError("forbidden:ticket-category");
  }
  return session;
}

export async function GET() {
  try {
    await checkAuth();
    const categories = await getTicketCategories();
    return Response.json(categories, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) {
      return err.toResponse();
    }
    return new ChatbotError("bad_request:ticket-category").toResponse();
  }
}

export async function POST(request: Request) {
  try {
    const session = await checkAdmin();

    let body: z.infer<typeof ticketCategorySchema>;
    try {
      body = ticketCategorySchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:ticket-category",
        "请求数据格式不正确。请检查后重试。"
      ).toResponse();
    }

    const result = await createTicketCategory({
      name: body.name,
      color: body.color,
      sortOrder: body.sortOrder,
      colorKey: body.colorKey,
      userId: session.user.id,
    });

    return Response.json(result, { status: 201 });
  } catch (err) {
    if (err instanceof ChatbotError) {
      return err.toResponse();
    }
    return new ChatbotError("bad_request:ticket-category").toResponse();
  }
}

export async function PATCH(request: Request) {
  try {
    await checkAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new ChatbotError(
        "bad_request:ticket-category",
        "缺少参数 id"
      ).toResponse();
    }

    const existing = await getTicketCategoryById({ id });
    if (!existing) {
      return new ChatbotError("not_found:ticket-category").toResponse();
    }

    let body: Partial<z.infer<typeof ticketCategorySchema>>;
    try {
      body = ticketCategorySchema.partial().parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:ticket-category",
        "请求数据格式不正确。"
      ).toResponse();
    }

    const result = await updateTicketCategory({
      id,
      name: body.name ?? existing.name,
      color: body.color ?? existing.color,
      sortOrder: body.sortOrder,
      colorKey: body.colorKey,
    });

    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) {
      return err.toResponse();
    }
    return new ChatbotError("bad_request:ticket-category").toResponse();
  }
}

export async function DELETE(request: Request) {
  try {
    await checkAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new ChatbotError(
        "bad_request:ticket-category",
        "缺少参数 id"
      ).toResponse();
    }

    const existing = await getTicketCategoryById({ id });
    if (!existing) {
      return new ChatbotError("not_found:ticket-category").toResponse();
    }

    const result = await deleteTicketCategory({ id });
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) {
      return err.toResponse();
    }
    return new ChatbotError("bad_request:ticket-category").toResponse();
  }
}
