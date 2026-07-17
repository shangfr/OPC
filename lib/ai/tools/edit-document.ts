import { tool, type UIMessageStreamWriter } from "ai";
import type { Session } from "next-auth";
import { z } from "zod";
import { getDocumentById, saveDocument } from "@/lib/db/queries";
import type { ChatMessage } from "@/lib/types";

type EditDocumentProps = {
  session: Session;
  dataStream: UIMessageStreamWriter<ChatMessage>;
};

export const editDocument = ({ session, dataStream }: EditDocumentProps) =>
  tool({
    description:
      "局部修改已有文档：查找精确字符串并替换。old_string须含3-5行上下文确保唯一。适合改样式、修bug、改错别字。不要用于全量重写。",
    inputSchema: z.object({
      id: z.string().describe("The ID of the artifact to edit"),
      old_string: z
        .string()
        .describe(
          "Exact string to find. Include 3-5 surrounding lines for uniqueness."
        ),
      new_string: z.string().describe("Replacement string"),
      replace_all: z
        .boolean()
        .optional()
        .describe(
          "Replace all occurrences instead of just the first (default false)"
        ),
    }),
    execute: async ({ id, old_string, new_string, replace_all }) => {
      const document = await getDocumentById({ id });

      if (!document) {
        return { error: "Document not found" };
      }

      if (document.userId !== session.user?.id) {
        return { error: "Forbidden" };
      }

      if (!document.content) {
        return { error: "Document has no content" };
      }

      if (!document.content.includes(old_string)) {
        return { error: "old_string not found in document" };
      }

      const updated = replace_all
        ? document.content.replaceAll(old_string, new_string)
        : document.content.replace(old_string, new_string);

      await saveDocument({
        id: document.id,
        title: document.title,
        kind: document.kind,
        content: updated,
        userId: document.userId,
        chatId: document.chatId,
      });

      dataStream.write({
        type: "data-clear",
        data: null,
        transient: true,
      });

      if (document.kind === "code") {
        dataStream.write({
          type: "data-codeDelta",
          data: updated,
          transient: true,
        });
      } else if (document.kind === "sheet") {
        dataStream.write({
          type: "data-sheetDelta",
          data: updated,
          transient: true,
        });
      } else {
        dataStream.write({
          type: "data-textDelta",
          data: updated,
          transient: true,
        });
      }

      dataStream.write({ type: "data-finish", data: null, transient: true });

      return {
        id,
        title: document.title,
        kind: document.kind,
        content:
          document.kind === "code"
            ? "The script has been edited successfully."
            : "The document has been edited successfully.",
      };
    },
  });
