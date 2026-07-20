import "server-only";

/**
 * 智谱 ASR（语音识别）服务客户端
 *
 * 文档: https://docs.bigmodel.cn/api-reference/audio-recognize
 *
 * 支持两种调用模式：
 * 1. 文件上传模式（同步）：音频文件 ≤ 25MB，直接 POST multipart/form-data
 * 2. URL 模式（异步）：音频文件较大时，先上传 OSS 再传 URL
 *
 * 本模块采用文件上传模式，适合聊天场景的短录音（通常 < 60 秒）。
 * 复用项目已有的 ZHIPU_API_KEY，无需额外配置。
 */

const ZHIPU_ASR_ENDPOINT =
  "https://open.bigmodel.cn/api/paas/v4/audio/transcriptions";

export interface AsrResult {
  success: boolean;
  text?: string;
  /** 识别置信度（0-1），部分响应不含此字段 */
  confidence?: number;
  /** 识别耗时（毫秒） */
  durationMs?: number;
  error?: string;
}

/**
 * 调用智谱 ASR 识别音频文件
 *
 * @param audioBlob 音频二进制数据（webm/wav/mp3/m4a 等）
 * @param filename 文件名（含扩展名，用于 MIME 推断）
 * @param options 可选参数
 *   - language: 识别语言，BCP-47 标签，默认 "zh"
 *   - prompt: 提示词，可指定领域词汇提升识别准确率
 *
 * @returns AsrResult
 */
export async function transcribeAudio(
  audioBlob: Blob,
  filename: string,
  options?: { language?: string; prompt?: string },
): Promise<AsrResult> {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      error: "ZHIPU_API_KEY 未配置，无法使用语音识别服务",
    };
  }

  const language = options?.language ?? "zh";
  const startTime = Date.now();

  try {
    // 智谱 ASR 接口兼容 OpenAI Whisper 格式：multipart/form-data
    const formData = new FormData();
    formData.append("file", audioBlob, filename);
    formData.append("model", "asr");
    formData.append("language", language);
    if (options?.prompt) {
      formData.append("prompt", options.prompt);
    }

    const response = await fetch(ZHIPU_ASR_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      body: formData,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMsg: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMsg =
          errorJson?.error?.message ||
          errorJson?.message ||
          `ASR 请求失败: ${response.status}`;
      } catch {
        errorMsg = `ASR 请求失败: ${response.status} ${errorText.slice(0, 200)}`;
      }
      return { success: false, error: errorMsg };
    }

    const data = await response.json();
    const text = data?.text?.trim();

    if (!text) {
      return {
        success: false,
        error: "ASR 返回空文本，可能是音频过短或无语音内容",
        durationMs: Date.now() - startTime,
      };
    }

    return {
      success: true,
      text,
      durationMs: Date.now() - startTime,
    };
  } catch (err) {
    const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
    return {
      success: false,
      error: isTimeout
        ? "ASR 识别超时（30秒），请缩短录音时长"
        : `ASR 请求异常: ${err instanceof Error ? err.message : String(err)}`,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * 校验音频文件大小是否在智谱 ASR 限制内（25MB）
 */
export function validateAudioSize(sizeBytes: number): boolean {
  const MAX_SIZE = 25 * 1024 * 1024; // 25MB
  return sizeBytes > 0 && sizeBytes <= MAX_SIZE;
}

/**
 * 根据文件名推断 MIME 类型
 */
export function inferAudioMime(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  const mimeMap: Record<string, string> = {
    webm: "audio/webm",
    wav: "audio/wav",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    ogg: "audio/ogg",
    flac: "audio/flac",
  };
  return mimeMap[ext ?? ""] ?? "audio/webm";
}
