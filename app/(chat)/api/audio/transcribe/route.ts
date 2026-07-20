import { auth } from "@/app/(auth)/auth";
import { transcribeAudio, validateAudioSize } from "@/lib/ai/asr-service";
import { ChatbotError } from "@/lib/errors";

/**
 * POST /api/audio/transcribe
 *
 * 接收浏览器 MediaRecorder 录制的音频文件，调用智谱 ASR 转写为文本。
 *
 * 请求格式：multipart/form-data
 *   - file: 音频文件（webm/wav/mp3/m4a，≤25MB）
 *   - language: 识别语言（可选，默认 "zh"）
 *   - prompt: 提示词（可选，指定领域词汇提升准确率）
 *
 * 响应格式：
 *   成功：{ success: true, text: "...", durationMs: 1234 }
 *   失败：{ success: false, error: "..." }
 *
 * 限流：复用 next-auth session，未登录拒绝访问
 */
export async function POST(request: Request) {
  try {
    // 1. 鉴权
    const session = await auth();
    if (!session?.user) {
      return new ChatbotError("unauthorized:chat").toResponse();
    }

    // 2. 解析 multipart/form-data
    const formData = await request.formData();
    const file = formData.get("file");
    const language = (formData.get("language") as string) || "zh";
    const prompt = formData.get("prompt") as string | null;

    if (!(file instanceof File)) {
      return new ChatbotError(
        "bad_request:api",
        "缺少音频文件，请上传 file 字段",
      ).toResponse();
    }

    // 3. 校验文件类型
    const allowedTypes = [
      "audio/webm",
      "audio/wav",
      "audio/mpeg",
      "audio/mp3",
      "audio/mp4",
      "audio/m4a",
      "audio/ogg",
      "audio/flac",
      "audio/x-wav",
    ];
    if (!allowedTypes.includes(file.type)) {
      return new ChatbotError(
        "bad_request:api",
        `不支持的音频格式: ${file.type || "未知"}，支持: webm/wav/mp3/m4a/ogg/flac`,
      ).toResponse();
    }

    // 4. 校验文件大小
    if (!validateAudioSize(file.size)) {
      return new ChatbotError(
        "bad_request:api",
        `音频文件大小超出限制（25MB），当前: ${(file.size / 1024 / 1024).toFixed(1)}MB`,
      ).toResponse();
    }

    // 5. 调用智谱 ASR
    const result = await transcribeAudio(file, file.name, {
      language,
      prompt: prompt || undefined,
    });

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error },
        { status: 422 },
      );
    }

    return Response.json({
      success: true,
      text: result.text,
      durationMs: result.durationMs,
    });
  } catch (err) {
    console.error("[audio/transcribe] error:", err);
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:api").toResponse();
  }
}
