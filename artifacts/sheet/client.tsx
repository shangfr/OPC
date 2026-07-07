import { parse, unparse } from "papaparse";
import { toast } from "sonner";
import { Artifact } from "@/components/chat/create-artifact";
import {
  CopyIcon,
  DownloadIcon,
  LineChartIcon,
  RedoIcon,
  SparklesIcon,
  UndoIcon,
} from "@/components/chat/icons";
import { SpreadsheetEditor } from "@/components/chat/sheet-editor";
import { downloadCSV } from "@/lib/artifact-export";

type Metadata = Record<string, never>;

export const sheetArtifact = new Artifact<"sheet", Metadata>({
  kind: "sheet",
  description: "适用于处理电子表格",
  initialize: () => null,
  onStreamPart: ({ setArtifact, streamPart }) => {
    if (streamPart.type === "data-sheetDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        isVisible: true,
        status: "streaming",
      }));
    }
  },
  content: ({ content, currentVersionIndex, onSaveContent, status }) => {
    return (
      <SpreadsheetEditor
        content={content}
        currentVersionIndex={currentVersionIndex}
        isCurrentVersion={true}
        saveContent={onSaveContent}
        status={status}
      />
    );
  },
  actions: [
    {
      icon: <UndoIcon size={18} />,
      description: "查看上一版本",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("prev");
      },
      isDisabled: ({ currentVersionIndex }) => {
        if (currentVersionIndex === 0) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <RedoIcon size={18} />,
      description: "查看下一版本",
      onClick: ({ handleVersionChange }) => {
        handleVersionChange("next");
      },
      isDisabled: ({ isCurrentVersion }) => {
        if (isCurrentVersion) {
          return true;
        }

        return false;
      },
    },
    {
      icon: <CopyIcon />,
      description: "复制为 .csv",
      onClick: ({ content }) => {
        const parsed = parse<string[]>(content, { skipEmptyLines: true });

        const nonEmptyRows = parsed.data.filter((row) =>
          row.some((cell) => cell.trim() !== "")
        );

        const cleanedCsv = unparse(nonEmptyRows);

        navigator.clipboard.writeText(cleanedCsv);
        toast.success("CSV 已复制到剪贴板！");
      },
    },
    {
      icon: <DownloadIcon />,
      description: "下载 CSV 文件",
      onClick: ({ title, content }) => {
        const parsed = parse<string[]>(content, { skipEmptyLines: true });
        const nonEmptyRows = parsed.data.filter((row) =>
          row.some((cell) => cell.trim() !== "")
        );
        const cleanedCsv = unparse(nonEmptyRows);
        downloadCSV(cleanedCsv, title);
        toast.success("CSV 文件已下载！");
      },
    },
  ],
  toolbar: [
    {
      description: "格式化并清理数据",
      icon: <SparklesIcon />,
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [{ type: "text", text: "请格式化并清理数据" }],
        });
      },
    },
    {
      description: "分析并可视化数据",
      icon: <LineChartIcon />,
      onClick: ({ sendMessage }) => {
        sendMessage({
          role: "user",
          parts: [
            {
              type: "text",
              text: "Can you please analyze and visualize the data by creating a new code artifact in python?",
            },
          ],
        });
      },
    },
  ],
});
