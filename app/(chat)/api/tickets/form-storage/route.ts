// app/(chat)/api/tickets/form-storage/route.ts
// ============================================================
// 表单 JSON 存储接口：将结构化表单以 JSON 文件形式存入 Vercel Blob
//
// 产品流程（PM 视角）：
//   - 用户确认结构化表单后，前端调用 POST /api/tickets/form-storage
//   - 后端将表单 JSON 写入 Vercel Blob（项目已配置 BLOB_READ_WRITE_TOKEN）
//   - 返回 Blob 公开访问 URL，前端将其存入 Ticket.content 字段
//   - 详情页通过 GET /api/tickets/form-storage?url=... 拉取并回显表单
//
// 设计要点：
//   - 复用项目已有的 @vercel/blob 依赖与 /api/files/upload 同款存储桶
//   - 文件名带时间戳 + 随机串，避免覆盖
//   - 仅允许 application/json 类型，防止滥用
//   - GET 接口支持跨域读取（Blob 本身是公开的，这里做一层代理便于前端统一处理）
// ============================================================

import { put, del } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { ChatbotError } from "@/lib/errors";

// ── POST: 保存表单 JSON 到 Blob ──
const saveSchema = z.object({
  form: z.record(z.unknown()).refine((v) => Object.keys(v).length > 0, {
    message: "表单数据不能为空",
  }),
  ticketId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatbotError("unauthorized:ticket").toResponse();
    }

    let body: z.infer<typeof saveSchema>;
    try {
      body = saveSchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:ticket",
        "表单数据格式不正确"
      ).toResponse();
    }

    // 生成唯一文件名：ticket-forms/{timestamp}-{random}.json
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 10);
    const ticketPart = body.ticketId ? `-${body.ticketId.slice(0, 8)}` : "";
    const pathname = `ticket-forms/form-${timestamp}-${random}${ticketPart}.json`;

    const jsonBuffer = Buffer.from(JSON.stringify(body.form, null, 2), "utf-8");

    const blob = await put(pathname, jsonBuffer, {
      access: "public",
      contentType: "application/json",
    });

    return NextResponse.json(
      {
        url: blob.url,
        pathname: blob.pathname,
        uploadedAt: new Date().toISOString(),
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[form-storage] 保存失败:", err);
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError(
      "bad_request:ticket",
      "表单存储失败，请稍后重试"
    ).toResponse();
  }
}

// ── GET: 从 Blob 拉取表单 JSON ──
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatbotError("unauthorized:ticket").toResponse();
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return new ChatbotError(
        "bad_request:ticket",
        "缺少参数 url"
      ).toResponse();
    }

    // 安全校验：只允许拉取 vercel blob 域名（防止 SSRF）
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return new ChatbotError("bad_request:ticket", "url 格式不正确").toResponse();
    }

    if (!parsedUrl.hostname.endsWith(".public.blob.vercel-storage.com")) {
      return new ChatbotError(
        "bad_request:ticket",
        "仅允许读取项目存储桶内的表单"
      ).toResponse();
    }

    const res = await fetch(parsedUrl.toString());
    if (!res.ok) {
      return new ChatbotError(
        "not_found:ticket",
        "表单数据不存在或已被删除"
      ).toResponse();
    }

    const form = await res.json();
    return NextResponse.json({ form, url: parsedUrl.toString() }, { status: 200 });
  } catch (err) {
    console.error("[form-storage] 读取失败:", err);
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket", "读取表单失败").toResponse();
  }
}

// ── DELETE: 删除 Blob 中的表单 JSON（工单删除时联动） ──
export async function DELETE(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatbotError("unauthorized:ticket").toResponse();
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return new ChatbotError("bad_request:ticket", "缺少参数 url").toResponse();
    }

    await del(url);
    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (err) {
    console.error("[form-storage] 删除失败:", err);
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket", "删除表单失败").toResponse();
  }
}
