import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  updateCategory,
} from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";
import { isAdmin } from "@/lib/utils";

const categorySchema = z.object({
  name: z.string().min(1, "名称不能为空").max(32, "名称最长 32 个字符"),
  color: z.string().default("#6366f1"),
  sortOrder: z.number().int().default(0),
  colorKey: z.string().default("indigo"),
});

const CATEGORY_COLORS = [
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#0ea5e9", // sky
  "#f97316", // orange
  "#f43f5e", // rose
  "#3b82f6", // blue
  "#14b8a6", // teal
  "#ec4899", // pink
];

async function checkAuth() {
  const session = await auth();
  if (!session?.user) {
    throw new ChatbotError("unauthorized:category");
  }
  return session;
}

async function checkAdmin() {
  const session = await checkAuth();
  if (!isAdmin(session.user)) {
    throw new ChatbotError("forbidden:category");
  }
  return session;
}

export async function GET() {
  try {
    await checkAuth();
    const categories = await getCategories();
    return Response.json(categories, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) {
      return err.toResponse();
    }
    return new ChatbotError("bad_request:category").toResponse();
  }
}

export async function POST(request: Request) {
  try {
    const session = await checkAdmin();

    let body: z.infer<typeof categorySchema>;
    try {
      body = categorySchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:category",
        "请求数据格式不正确。请检查后重试。"
      ).toResponse();
    }

    const result = await createCategory({
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
    return new ChatbotError("bad_request:category").toResponse();
  }
}

export async function PATCH(request: Request) {
  try {
    await checkAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new ChatbotError(
        "bad_request:category",
        "缺少参数 id"
      ).toResponse();
    }

    const existing = await getCategoryById({ id });
    if (!existing) {
      return new ChatbotError("not_found:category").toResponse();
    }

    let body: Partial<z.infer<typeof categorySchema>>;
    try {
      body = categorySchema.partial().parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:category",
        "请求数据格式不正确。"
      ).toResponse();
    }

    const result = await updateCategory({
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
    return new ChatbotError("bad_request:category").toResponse();
  }
}

export async function DELETE(request: Request) {
  try {
    await checkAdmin();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return new ChatbotError(
        "bad_request:category",
        "缺少参数 id"
      ).toResponse();
    }

    const existing = await getCategoryById({ id });
    if (!existing) {
      return new ChatbotError("not_found:category").toResponse();
    }

    const result = await deleteCategory({ id });
    return Response.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof ChatbotError) {
      return err.toResponse();
    }
    return new ChatbotError("bad_request:category").toResponse();
  }
}
