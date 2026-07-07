"use client";

import { toast } from "sonner";
import { CodeEditor } from "@/components/chat/code-editor";
import { Artifact } from "@/components/chat/create-artifact";
import {
  CopyIcon,
  DownloadIcon,
  PlayIcon,
  RedoIcon,
  UndoIcon,
} from "@/components/chat/icons";
import { exportHtmlAsPDF } from "@/lib/artifact-export";

type Metadata = Record<string, never>;

function openPreviewWindow(content: string) {
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    toast.error("请允许弹出窗口后重试");
    URL.revokeObjectURL(url);
    return;
  }
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const htmlArtifact = new Artifact<"html", Metadata>({
  kind: "html",
  description: "适用于 HTML 页面生成和预览",
  initialize: () => undefined,
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === "data-htmlDelta") {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.data,
        isVisible:
          draftArtifact.status === "streaming" && streamPart.data.length > 300
            ? true
            : draftArtifact.isVisible,
        status: "streaming",
      }));
    }
  },
  content: ({ content, ...props }) => {
    if (!content) {
      return null;
    }

    return (
      <div className="relative min-h-[200px]">
        <CodeEditor content={content} {...props} />
      </div>
    );
  },
  actions: [
    {
      icon: <PlayIcon size={18} />,
      label: "运行",
      description: "在新窗口中预览 HTML 页面",
      onClick: ({ content }) => {
        openPreviewWindow(content);
      },
    },
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
      icon: <CopyIcon size={18} />,
      description: "复制 HTML 代码",
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success("HTML 代码已复制到剪贴板！");
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: "导出为 PDF",
      onClick: ({ title, content }) => {
        exportHtmlAsPDF(title, content);
      },
    },
  ],
  toolbar: [],
});
