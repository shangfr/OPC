import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { documentHandlersByArtifactKind } from "@/lib/artifacts/server";
import { getDocumentById } from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";

type UpdateDocumentProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
  modelId: string;
};

export const updateDocument = ({
  session,
  dataStream,
  modelId,
}: UpdateDocumentProps) =>
  tool({
    description:
      "全量重写已有文档。仅当大部分内容需变更时使用，局部修改请用editDocument。",
    inputSchema: z.object({
      id: z.string().describe("The ID of the artifact to rewrite"),
      description: z
        .string()
        .default("Improve the content")
        .describe("The description of changes that need to be made"),
    }),
    execute: async ({ id, description }) => {
      const document = await getDocumentById({ id });

      if (!document) {
        return {
          error: "Document not found",
        };
      }

      if (document.userId !== session.user?.id) {
        return { error: "Forbidden" };
      }

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      const documentHandler = documentHandlersByArtifactKind.find(
        (documentHandlerByArtifactKind) =>
          documentHandlerByArtifactKind.kind === document.kind
      );

      if (!documentHandler) {
        throw new Error(`No document handler found for kind: ${document.kind}`);
      }

      await documentHandler.onUpdateDocument({
        document,
        description,
        dataStream,
        session,
        modelId,
        chatId: document.chatId,
      });

      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content:
          document.kind === "code"
            ? "The script has been updated successfully."
            : "The document has been updated successfully.",
      };
    },
  });
