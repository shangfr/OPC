import { streamText } from "ai";
import { htmlPrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

function stripFences(code: string): string {
  return code
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

export const htmlDocumentHandler = createDocumentHandler<"html">({
  kind: "html",
  onCreateDocument: async ({ title, dataStream, modelId }) => {
    let draftContent = "";

    const { fullStream } = streamText({
      model: getLanguageModel(modelId),
      system: `${htmlPrompt}\n\n不要输出 markdown 代码块标记，不要任何解释说明，直接输出 HTML 代码。`,
      prompt: title,
    });

    for await (const delta of fullStream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
        dataStream.write({
          type: "data-htmlDelta",
          data: stripFences(draftContent),
          transient: true,
        });
      }
    }

    return stripFences(draftContent);
  },
  onUpdateDocument: async ({ document, description, dataStream, modelId }) => {
    let draftContent = "";

    const { fullStream } = streamText({
      model: getLanguageModel(modelId),
      system: `${updateDocumentPrompt(document.content, "html")}\n\n只输出完整的更新后 HTML 代码。不要输出 markdown 代码块标记，不要任何解释说明。`,
      prompt: description,
    });

    for await (const delta of fullStream) {
      if (delta.type === "text-delta") {
        draftContent += delta.text;
        dataStream.write({
          type: "data-htmlDelta",
          data: stripFences(draftContent),
          transient: true,
        });
      }
    }

    return stripFences(draftContent);
  },
});
