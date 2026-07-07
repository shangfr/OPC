// app/(chat)/api/chat/schema.ts
import { z } from "zod";

const textPartSchema = z.object({
  type: z.enum(["text"]),
  text: z.string().min(1).max(10000), // 🚨 修改：放宽到 10 万字符
});

const filePartSchema = z.object({
  type: z.enum(["file"]),
  mediaType: z.enum([
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-msvideo",
    "video/x-matroska",
    "text/plain",
    "text/csv",
    "text/markdown",
    "application/pdf",
    "application/json",
    "application/xml",
    "text/xml",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]),
  name: z.string().min(1).max(100),
  url: z.string().url(),
});

const partSchema = z.union([textPartSchema, filePartSchema]);

const userMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(["user"]),
  parts: z.array(partSchema),
});

const toolApprovalMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  parts: z.array(z.record(z.unknown())),
});

export const postRequestBodySchema = z.object({
  id: z.string().uuid(),
  message: userMessageSchema.optional(),
  messages: z.array(toolApprovalMessageSchema).optional(),
  selectedChatModel: z.string(),
  selectedVisibilityType: z.enum(["public", "private"]),
  agentId: z.string().uuid().optional(),
  thinkingEnabled: z.boolean().default(true),
  isNewChat: z.boolean().optional(),
  summarizeTask: z.string().optional(), // 🚨 新增：汇总任务标识
});

export type PostRequestBody = z.infer<typeof postRequestBodySchema>;
