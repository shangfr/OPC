"use client";

import { formatDistance } from "date-fns";
import { zhCN } from "date-fns/locale";
import {
  AlertCircle,
  ArrowLeft,
  ClipboardCopy,
  Code2,
  FileText,
  FileType2,
  Image as ImageIcon,
  Loader2,
  MessageSquare, // 新增：对话图标
  RefreshCw,
  Search,
  Sheet,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR, { useSWRConfig } from "swr";
import { cn, fetcher } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// --- 类型定义 ---
type ArtifactKind = "text" | "code" | "html" | "image" | "sheet";

type UserDocument = {
  id: string;
  title: string;
  kind: ArtifactKind;
  content: string;
  createdAt: string;
  chatId?: string; // 新增：关联的对话ID，用于跳转
};

// --- 常量定义 ---
const KIND_META: Record<
  ArtifactKind,
  {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    bg: string;
  }
> = {
  text: {
    label: "文本",
    icon: FileText,
    color: "text-blue-600",
    bg: "bg-blue-50 dark:bg-blue-950/40",
  },
  code: {
    label: "代码",
    icon: Code2,
    color: "text-violet-600",
    bg: "bg-violet-50 dark:bg-violet-950/40",
  },
  html: {
    label: "网页",
    icon: FileType2,
    color: "text-orange-600",
    bg: "bg-orange-50 dark:bg-orange-950/40",
  },
  image: {
    label: "图片",
    icon: ImageIcon,
    color: "text-pink-600",
    bg: "bg-pink-50 dark:bg-pink-950/40",
  },
  sheet: {
    label: "表格",
    icon: Sheet,
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
};

// --- 自定义 Hook: 防抖 ---
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// --- 子组件: 制品卡片 ---
interface ArtifactCardProps {
  doc: UserDocument;
  onClick: (doc: UserDocument) => void;
}

function ArtifactCard({ doc, onClick }: ArtifactCardProps) {
  const meta = KIND_META[doc.kind];
  const Icon = meta.icon;

  return (
    <button
      className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-3.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-md sm:p-4"
      onClick={() => onClick(doc)}
      type="button"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            meta.bg
          )}
        >
          <Icon className={cn("size-4", meta.color)} />
        </div>
        <span className="shrink-0 text-[10px] text-muted-foreground/50">
          {formatDistance(new Date(doc.createdAt), new Date(), {
            addSuffix: true,
            locale: zhCN,
          })}
        </span>
      </div>
      <h3 className="line-clamp-2 text-sm font-medium text-foreground">
        {doc.title || "无标题"}
      </h3>
      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
        {doc.content?.slice(0, 100) || "无内容"}
      </p>
    </button>
  );
}

// --- 子组件: 预览弹窗 ---
interface ArtifactPreviewDialogProps {
  doc: UserDocument | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (doc: UserDocument) => void;
  isDeleting: boolean;
}

function ArtifactPreviewDialog({
  doc,
  open,
  onOpenChange,
  onDelete,
  isDeleting,
}: ArtifactPreviewDialogProps) {
  const router = useRouter(); // 在子组件中使用 router

  if (!doc) return null;

  const meta = KIND_META[doc.kind];
  const Icon = meta.icon;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(doc.content);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动选择文本复制");
    }
  };

  // 打开对话逻辑
  const handleOpenChat = () => {
    if (!doc.chatId) {
      toast.warning("无法找到来源对话");
      return;
    }
    // 假设你的对话页面路由是 /chat/[chatId]
    router.push(`/chat/${doc.chatId}`);
    onOpenChange(false); // 关闭弹窗
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-mobile-friendly max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-md",
                meta.bg
              )}
            >
              <Icon className={cn("size-3.5", meta.color)} />
            </div>
            <span className="truncate">{doc.title || "无标题"}</span>
          </DialogTitle>
          <DialogDescription>
            {`${meta.label} · ${formatDistance(new Date(doc.createdAt), new Date(), {
              addSuffix: true,
              locale: zhCN,
            })}`}
          </DialogDescription>
        </DialogHeader>

        {/* 内容预览区：图片渲染 img，其他渲染 pre */}
        <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border/50 bg-muted/30 p-3 sm:p-4">
          {doc.kind === "image" && doc.content ? (
            <img
              src={doc.content}
              alt={doc.title}
              className="mx-auto max-w-full rounded-sm object-contain"
            />
          ) : (
            <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/80">
              {doc.content || "无内容"}
            </pre>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {/* 删除按钮 */}
            <button
              className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-50"
              disabled={isDeleting}
              onClick={() => onDelete(doc)}
              type="button"
            >
              {isDeleting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              删除
            </button>

            {/* 打开对话按钮 */}
            {doc.chatId && (
              <button
                className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                onClick={handleOpenChat}
                type="button"
              >
                <MessageSquare className="size-3.5" />
                打开对话
              </button>
            )}

            {/* 复制按钮 */}
            <button
              className="touch-target inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
              onClick={handleCopy}
              type="button"
            >
              <ClipboardCopy className="size-3.5" />
              复制
            </button>
          </div>
          
          <button
            className="touch-target rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            关闭
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- 主页面组件 ---
export default function ArtifactsPage() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data, isLoading, error } = useSWR<{ documents: UserDocument[] }>(
    "/api/documents/list",
    fetcher
  );

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [previewDoc, setPreviewDoc] = useState<UserDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const documents = data?.documents ?? [];

  // 搜索过滤逻辑
  const filteredDocs = useMemo(() => {
    if (!debouncedSearch.trim()) return documents;
    const q = debouncedSearch.trim().toLowerCase();
    return documents.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.content.toLowerCase().includes(q)
    );
  }, [documents, debouncedSearch]);

  // 按类型分组逻辑
  const filteredGrouped = useMemo(() => {
    const map = new Map<ArtifactKind, UserDocument[]>();
    for (const doc of filteredDocs) {
      const bucket = map.get(doc.kind) ?? [];
      bucket.push(doc);
      map.set(doc.kind, bucket);
    }
    return map;
  }, [filteredDocs]);

  const handleDelete = async (doc: UserDocument) => {
    if (!confirm("确定要删除这个制品吗？此操作无法撤销。")) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/list?id=${doc.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      mutate("/api/documents/list");
      setPreviewDoc(null);
      toast.success("已删除制品");
    } catch {
      toast.error("删除失败，请重试");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex h-dvh flex-col bg-background">
      {/* 顶部栏 */}
      <header className="page-header shrink-0">
        <button
          className="back-button"
          onClick={() => router.back()}
          type="button"
        >
          <ArrowLeft className="size-3.5" />
          <span className="hidden sm:inline">返回</span>
        </button>
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <h1 className="truncate text-sm font-semibold">我的制品</h1>
          <span className="shrink-0 text-xs text-muted-foreground">
            {documents.length} 个
          </span>
        </div>
      </header>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto px-4 py-6 md:px-6">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                加载失败
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                无法获取制品列表，请检查网络连接
              </p>
            </div>
            <button
              onClick={() => mutate("/api/documents/list")}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className="size-3.5" />
              重试
            </button>
          </div>
        ) : documents.length === 0 ? (
          <div className="empty-state h-full flex flex-col items-center justify-center">
            <FileText className="mb-3 size-12 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">还没有制品</p>
            <p className="mt-1 px-6 text-center text-xs text-muted-foreground/60">
              在对话中让 OPC 创建文档、代码、表格等制品，它们会自动保存在这里
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl">
            {/* 搜索框 */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/50" />
              <input
                className="search-input"
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索制品标题或内容..."
                type="text"
                value={search}
              />
            </div>

            {/* 按类型分组展示 */}
            {(["text", "code", "html", "image", "sheet"] as ArtifactKind[])
              .filter((kind) => (filteredGrouped.get(kind) ?? []).length > 0)
              .map((kind) => {
                const meta = KIND_META[kind];
                const docs = filteredGrouped.get(kind) ?? [];
                const Icon = meta.icon;
                return (
                  <section className="mb-8" key={kind}>
                    <div className="mb-3 flex items-center gap-2">
                      <div
                        className={cn(
                          "flex size-7 items-center justify-center rounded-lg",
                          meta.bg
                        )}
                      >
                        <Icon className={cn("size-3.5", meta.color)} />
                      </div>
                      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        {meta.label}
                      </h2>
                      <span className="text-[10px] text-muted-foreground/50">
                        {docs.length} 个
                      </span>
                    </div>
                    <div className="card-grid">
                      {docs.map((doc) => (
                        <ArtifactCard
                          key={`${doc.id}-${doc.createdAt}`}
                          doc={doc}
                          onClick={setPreviewDoc}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}

            {filteredDocs.length === 0 && (
              <div className="empty-state py-16 flex flex-col items-center justify-center">
                <Search className="mb-3 size-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">未找到匹配的制品</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 预览弹窗 */}
      <ArtifactPreviewDialog
        doc={previewDoc}
        open={!!previewDoc}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
        onDelete={handleDelete}
        isDeleting={deleting}
      />
    </div>
  );
}
