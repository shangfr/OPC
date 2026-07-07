import Image from "next/image";
import type { Attachment } from "@/lib/types";
import { Spinner } from "../ui/spinner";
import { CrossSmallIcon } from "./icons";

/**
 * 根据文件 contentType 获取简短的可读类型标签。
 */
function getFileTypeLabel(contentType?: string): string {
  if (!contentType) {
    return "文件";
  }
  if (contentType.startsWith("image/")) {
    return "图片";
  }
  if (contentType.startsWith("video/")) {
    return "视频";
  }
  if (contentType.startsWith("audio/")) {
    return "音频";
  }
  if (contentType.includes("pdf")) {
    return "PDF";
  }
  if (contentType.includes("word") || contentType.includes("document")) {
    return "文档";
  }
  if (contentType.includes("sheet") || contentType.includes("excel")) {
    return "表格";
  }
  if (
    contentType.includes("presentation") ||
    contentType.includes("powerpoint")
  ) {
    return "演示";
  }
  if (contentType.startsWith("text/")) {
    return "文本";
  }
  if (contentType.includes("json") || contentType.includes("javascript")) {
    return "代码";
  }
  if (contentType.includes("zip") || contentType.includes("compressed")) {
    return "压缩包";
  }
  return "文件";
}

/**
 * 根据文件类型返回首字母，用于非图片文件的占位图标。
 */
function getFileInitial(label: string): string {
  return label.charAt(0);
}

export const PreviewAttachment = ({
  attachment,
  isUploading = false,
  onRemove,
}: {
  attachment: Attachment;
  isUploading?: boolean;
  onRemove?: () => void;
}) => {
  const { name, url, contentType } = attachment;
  const isImage = contentType?.startsWith("image");
  const typeLabel = getFileTypeLabel(contentType);

  return (
    <div
      className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border/40 bg-muted"
      data-testid="input-attachment-preview"
    >
      {isImage ? (
        <Image
          alt={name ?? "attachment"}
          className="size-full object-cover"
          height={96}
          src={url}
          width={96}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1.5 px-2 text-muted-foreground">
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-lg bg-muted-foreground/10 text-sm font-semibold uppercase"
          >
            {getFileInitial(typeLabel)}
          </span>
          <span className="line-clamp-1 text-[10px] font-medium leading-tight">
            {typeLabel}
          </span>
        </div>
      )}

      {/* 文件名提示：悬停时显示完整文件名 */}
      {name && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 py-1 text-[10px] text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          role="tooltip"
        >
          {name}
        </div>
      )}

      {isUploading && (
        <output
          aria-label="正在上传附件"
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 backdrop-blur-sm"
          data-testid="input-attachment-loader"
        >
          <Spinner className="size-5" />
        </output>
      )}

      {onRemove && !isUploading && (
        <button
          aria-label={`移除附件 ${name ?? ""}`.trim()}
          className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-black/60 text-white opacity-100 backdrop-blur-sm transition-all hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 md:opacity-0 md:group-hover:opacity-100"
          onClick={onRemove}
          type="button"
        >
          <CrossSmallIcon size={10} />
        </button>
      )}
    </div>
  );
};
