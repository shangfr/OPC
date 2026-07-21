"use client";

import {
  ArrowLeft,
  BookOpen,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHeaderActions } from "@/components/chat/header-actions-context";

// ── Types ──

interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  document_size: number;
  word_num: number;
  length: number;
  embedding_id: number;
  contextual: number;
}

interface DocumentItem {
  id: string;
  name: string;
  embedding_stat: string;
  word_num: number;
  length: number;
}

// ── View ──

export function KnowledgeView({ userIsAdmin = false }: { userIsAdmin?: boolean }) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null);
  const [usage, setUsage] = useState<{
    used: { word_num: number; length: number };
    total: { word_num: number; length: number };
  } | null>(null);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  // 将「新建知识库」按钮注册到 GlobalHeader
  const { setActions } = useHeaderActions();
  useEffect(() => {
    setActions(
      <Button
        key="create-kb"
        className="gap-1.5"
        onClick={() => setCreateOpen(true)}
        size="sm"
      >
        <Plus className="size-4" />
        <span className="hidden sm:inline">新建知识库</span>
        <span className="sm:hidden">新建</span>
      </Button>
    );
    return () => setActions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Document management
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "kb" | "doc";
    id: string;
    name: string;
  } | null>(null);

  // ── Fetch knowledge bases ──

  const fetchKnowledgeBases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge");
      if (res.ok) {
        const data = await res.json();
        const list: KnowledgeBase[] = data?.list ?? [];
        setKnowledgeBases(list);
        // 仅管理员显示全局用量
        if (data?.usage) {
          setUsage(data.usage);
        }

        // listKnowledgeBases returns stale stats;
        // compute real stats from document list for each KB
        await Promise.all(
          list.map(async (kb) => {
            try {
              const docRes = await fetch(
                `/api/knowledge/documents?knowledgeId=${kb.id}`,
              );
              if (docRes.ok) {
                const docData = await docRes.json();
                const docs: DocumentItem[] = docData?.list ?? [];
                setKnowledgeBases((prev) =>
                  prev.map((k) =>
                    k.id === kb.id
                      ? {
                          ...k,
                          document_size: docs.length,
                          word_num: docs.reduce(
                            (s, d) => s + d.word_num,
                            0,
                          ),
                        }
                      : k,
                  ),
                );
              }
            } catch {
              // non-fatal
            }
          }),
        );
      }
    } catch {
      toast.error("加载知识库列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  // ── Fetch documents & refresh KB stats in a single request ──
  // ZhiPu's list & detail APIs return stale document_size/word_num,
  // so we compute real stats from the document list instead.
  // 优化：原先 fetchDocuments 与 refreshKbStats 各自请求同一接口，
  // 现合并为一次请求，同时更新文档列表与知识库统计数据。

  const fetchDocuments = useCallback(async (kbId: string) => {
    setDocsLoading(true);
    try {
      const res = await fetch(
        `/api/knowledge/documents?knowledgeId=${kbId}`,
      );
      if (res.ok) {
        const data = await res.json();
        const docs: DocumentItem[] = data?.list ?? [];
        // 更新文档列表
        setDocuments(docs);
        // 同时更新知识库统计数据（文档数 & 字数）
        const computedSize = docs.length;
        const computedWordNum = docs.reduce((sum, d) => sum + d.word_num, 0);
        setKnowledgeBases((prev) =>
          prev.map((kb) =>
            kb.id === kbId
              ? {
                  ...kb,
                  document_size: computedSize,
                  word_num: computedWordNum,
                }
              : kb,
          ),
        );
        setSelectedKb((prev) => {
          if (!prev || prev.id !== kbId) return prev;
          return {
            ...prev,
            document_size: computedSize,
            word_num: computedWordNum,
          };
        });
      }
    } catch {
      toast.error("加载文档列表失败");
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedKb) {
      fetchDocuments(selectedKb.id);
    }
  }, [selectedKb?.id, fetchDocuments]);

  // ── Create KB ──

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (res.ok) {
        toast.success("知识库已创建");
        setCreateOpen(false);
        setNewName("");
        await fetchKnowledgeBases();
      } else {
        toast.error("创建失败");
      }
    } catch {
      toast.error("创建失败");
    } finally {
      setCreating(false);
    }
  };

  // ── Delete KB ──

  const handleDeleteKb = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/knowledge?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`已删除知识库「${name}」`);
        if (selectedKb?.id === id) {
          setSelectedKb(null);
          setDocuments([]);
        }
        await fetchKnowledgeBases();
      } else {
        toast.error("删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  // ── Upload documents ──

  const handleUpload = async (files: FileList | null) => {
    if (!files || !selectedKb || files.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("knowledgeId", selectedKb.id);
      for (const file of Array.from(files)) {
        formData.append("files", file);
      }

      const res = await fetch("/api/knowledge/documents", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        const successCount = data.successInfos?.length ?? 0;
        const failCount = data.failedInfos?.length ?? 0;

        if (successCount > 0) {
          toast.success(`已上传 ${successCount} 个文件`);
        }
        if (failCount > 0) {
          toast.error(`${failCount} 个文件上传失败`);
        }
        await fetchDocuments(selectedKb.id);
      } else {
        toast.error("上传失败");
      }
    } catch {
      toast.error("上传失败");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // ── Delete document ──

  const handleDeleteDoc = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/knowledge/documents?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(`已删除「${name}」`);
        if (selectedKb) {
          await fetchDocuments(selectedKb.id);
        }
      } else {
        toast.error("删除失败");
      }
    } catch {
      toast.error("删除失败");
    }
  };

  // ── Confirm delete ──

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === "kb") {
      await handleDeleteKb(deleteTarget.id, deleteTarget.name);
    } else {
      await handleDeleteDoc(deleteTarget.id, deleteTarget.name);
    }
    setDeleteTarget(null);
  };

  const embeddingModelLabel = (id: number) => {
    switch (id) {
      case 3:
        return "Embedding-2";
      case 11:
        return "Embedding-3";
      case 12:
        return "Embedding-3-pro";
      default:
        return `ID:${id}`;
    }
  };

  return (
    <div className="page-container">

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.5fr]">
          {/* Left: KB list — hidden on mobile when a KB is selected */}
          <div
            className={`space-y-3 ${selectedKb ? "hidden lg:block" : ""}`}
          >
            {knowledgeBases.length === 0 ? (
              <div className="empty-state py-16">
                <BookOpen className="mb-3 size-10 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  还没有知识库
                </p>
                <Button
                  className="mt-3 gap-2"
                  onClick={() => setCreateOpen(true)}
                  variant="outline"
                >
                  <Plus className="size-4" />
                  创建第一个知识库
                </Button>
              </div>
            ) : (
              knowledgeBases.map((kb) => (
                <div
                  className={`group flex w-full cursor-pointer items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                    selectedKb?.id === kb.id
                      ? "border-primary/50 bg-primary/[0.03] ring-1 ring-primary/20"
                      : "border-border/60 hover:border-border hover:bg-accent/30"
                  }`}
                  key={kb.id}
                  onClick={() =>
                    setSelectedKb(
                      selectedKb?.id === kb.id ? null : kb,
                    )
                  }
                  role="button"
                  tabIndex={0}
                >
                  <div className="mt-0.5 rounded-lg bg-primary/10 p-2">
                    <BookOpen className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{kb.name}</span>
                      {kb.contextual === 1 && (
                        <Badge
                          className="px-1.5 py-0 text-[10px]"
                          variant="secondary"
                        >
                          增强
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{kb.document_size} 文档</span>
                      <span>
                        {(kb.word_num / 1000).toFixed(1)}k 字
                      </span>
                      <span>{embeddingModelLabel(kb.embedding_id)}</span>
                    </div>
                  </div>
                  <Button
                    className="size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({
                        type: "kb",
                        id: kb.id,
                        name: kb.name,
                      });
                    }}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Right: Document management — hidden on mobile when no KB selected */}
          <div
            className={`rounded-xl border border-border/60 p-5 ${!selectedKb ? "hidden lg:block" : ""}`}
          >
            {!selectedKb ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center gap-4 text-muted-foreground">
                <FileText className="size-8 opacity-30" />
                <p className="text-sm">
                  {knowledgeBases.length > 0
                    ? "选择一个知识库查看文档"
                    : "创建知识库后可管理文档"}
                </p>
                {/* 存储用量：仅管理员可见 */}
                {userIsAdmin && usage && (
                  <div className="mt-2 w-full max-w-[240px] space-y-2 rounded-lg border border-border/40 px-4 py-3">
                    <p className="text-center text-xs font-medium">
                      存储用量
                    </p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all"
                        style={{
                          width: `${Math.min((usage.used.word_num / usage.total.word_num) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <p className="text-center text-[11px]">
                      {(usage.used.word_num / 10000).toFixed(1)} 万字 /{" "}
                      {(usage.total.word_num / 10000).toFixed(0)} 万字
                      <span className="ml-1.5 text-muted-foreground/60">
                        (免费 1GB)
                      </span>
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {/* Mobile back button */}
                    <Button
                      className="lg:hidden"
                      onClick={() => setSelectedKb(null)}
                      size="icon"
                      variant="ghost"
                    >
                      <ArrowLeft className="size-4" />
                    </Button>
                    <div>
                      <h2 className="font-medium">{selectedKb.name}</h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {documents.length} 个文档 ·{" "}
                        {embeddingModelLabel(selectedKb.embedding_id)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      accept=".txt,.doc,.docx,.pdf,.ppt,.pptx,.xls,.xlsx,.csv,.md"
                      className="hidden"
                      multiple
                      onChange={(e) => handleUpload(e.target.files)}
                      ref={fileInputRef}
                      type="file"
                    />
                    <Button
                      className="gap-1.5"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      size="sm"
                    >
                      {uploading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Upload className="size-3.5" />
                      )}
                      上传文档
                    </Button>
                  </div>
                </div>

                {docsLoading ? (
                  <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    加载文档列表...
                  </div>
                ) : documents.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-muted-foreground">
                    <FileText className="mb-2 size-6 opacity-30" />
                    <p className="text-sm">暂无文档</p>
                    <p className="mt-1 text-xs">
                      点击上方按钮上传 PDF、DOCX、TXT 等文件
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {documents.map((doc) => (
                      <div
                        className="group flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent/50"
                        key={doc.id}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                          <span className="truncate">
                            {doc.name}
                          </span>
                          {doc.embedding_stat !== "done" && (
                            <Badge
                              className="shrink-0 px-1.5 py-0 text-[10px]"
                              variant={
                                doc.embedding_stat === "processing"
                                  ? "secondary"
                                  : "destructive"
                              }
                            >
                              {doc.embedding_stat === "processing"
                                ? "处理中"
                                : doc.embedding_stat === "fail"
                                  ? "失败"
                                  : doc.embedding_stat}
                            </Badge>
                          )}
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {doc.word_num > 0
                              ? `${(doc.word_num / 1000).toFixed(1)}k 字`
                              : ""}
                          </span>
                        </div>
                        <Button
                          className="size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          onClick={() =>
                            setDeleteTarget({
                              type: "doc",
                              id: doc.id,
                              name: doc.name,
                            })
                          }
                          size="icon"
                          variant="ghost"
                        >
                          <X className="size-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="mt-4 text-[11px] text-muted-foreground">
                  支持格式：PDF、DOCX、DOC、TXT、CSV、XLSX、XLS、PPTX、PPT、MD
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create dialog */}
      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent className="dialog-mobile-friendly max-w-sm">
          <DialogHeader>
            <DialogTitle>新建知识库</DialogTitle>
            <DialogDescription>
              创建智谱知识库用于存储和检索文档，使用 Embedding-3
              向量化模型
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="kb-name">知识库名称</Label>
              <Input
                id="kb-name"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                placeholder="例如：产品文档库"
                value={newName}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => setCreateOpen(false)}
              variant="outline"
            >
              取消
            </Button>
            <Button
              disabled={creating || !newName.trim()}
              onClick={handleCreate}
            >
              {creating ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        open={!!deleteTarget}
      >
        <DialogContent className="dialog-mobile-friendly max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              {deleteTarget?.type === "kb"
                ? `确定要删除知识库「${deleteTarget.name}」吗？其中的所有文档也会被删除，此操作不可撤销。`
                : `确定要删除文档「${deleteTarget?.name}」吗？此操作不可撤销。`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setDeleteTarget(null)}
              variant="outline"
            >
              取消
            </Button>
            <Button onClick={confirmDelete} variant="destructive">
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
