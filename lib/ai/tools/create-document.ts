import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import {
  artifactKinds,
  documentHandlersByArtifactKind,
} from "@/lib/artifacts/server";
import type { ChatMessage } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

type CreateDocumentProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  modelId: string;
  chatId: string;
};

export const createDocument = ({
  session,
  dataStream,
  modelId,
  chatId,
}: CreateDocumentProps) => {
  // 防重入守卫：streamText 多步调用中，LLM 可能重复调用 createDocument
  // 导致生成 2-3 个重复文档。用闭包标志确保一轮只创建一次。
  let hasCreated = false;

  return tool({
    description:
      "创建文档/网页/代码/表格并显示在侧边面板。kind: 'html'=网页, 'code'=代码, 'text'=文档, 'sheet'=表格。一次包含全部内容，不要先创建再编辑。一轮对话中只能调用一次，重复调用将被拒绝。",
    inputSchema: z.object({
      title: z.string().describe("The title of the artifact"),
      kind: z
        .enum(artifactKinds)
        .describe(
          "REQUIRED. 'html' for web pages/HTML, 'code' for programming/algorithms, 'text' for essays/writing, 'sheet' for spreadsheets"
        ),
    }),
    execute: async ({ title, kind }) => {
      if (hasCreated) {
        return {
          error:
            "已创建过文档，请勿重复调用 createDocument。如需修改已有文档，请使用 editDocument（局部修改）或 updateDocument（全量重写）。",
        };
      }
      hasCreated = true;

      const id = generateUUID();

      dataStream.write({
        type: "data-kind",
        data: kind,
        transient: true,
      });

      dataStream.write({
        type: "data-id",
        data: id,
        transient: true,
      });

      dataStream.write({
        type: "data-title",
        data: title,
        transient: true,
      });

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === kind
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${kind}`);
      }

      await documentHandler.onCreateDocument({
        id,
        title,
        dataStream,
        session,
        modelId,
        chatId,
      });

      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title,
        kind,
        chatId,
        content:
          kind === "code"
            ? "A script was created and is now visible to the user."
            : kind === "html"
              ? "An HTML page was created and is now visible to the user."
              : "A document was created and is now visible to the user.",
      };
    },
  });
};
