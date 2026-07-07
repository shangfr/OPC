"use client";

import { BookOpen, Settings2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ── Types ──

interface KnowledgeBase {
  id: string;
  name: string;
  document_size: number;
  word_num: number;
}

interface KnowledgeSectionProps {
  value: string; // knowledgeId or "__none__"
  onChange: (knowledgeId: string) => void;
}

// ── Component ──

export function KnowledgeSection({ value, onChange }: KnowledgeSectionProps) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchKnowledgeBases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/knowledge");
      if (res.ok) {
        const data = await res.json();
        const list: KnowledgeBase[] = data?.list ?? [];
        setKnowledgeBases(list);

        // ZhiPu list API returns stale stats;
        // compute real stats from document list for each KB
        await Promise.all(
          list.map(async (kb) => {
            try {
              const docRes = await fetch(
                `/api/knowledge/documents?knowledgeId=${kb.id}`
              );
              if (docRes.ok) {
                const docData = await docRes.json();
                const docs: { word_num: number }[] =
                  docData?.list ?? [];
                setKnowledgeBases((prev) =>
                  prev.map((k) =>
                    k.id === kb.id
                      ? {
                          ...k,
                          document_size: docs.length,
                          word_num: docs.reduce(
                            (s, d) => s + d.word_num,
                            0
                          ),
                        }
                      : k
                  )
                );
              }
            } catch {
              // non-fatal
            }
          })
        );
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKnowledgeBases();
  }, [fetchKnowledgeBases]);

  const statLabel = (kb: KnowledgeBase) =>
    `${kb.document_size} 文档 · ${(kb.word_num / 1000).toFixed(1)}k 字`;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <BookOpen className="size-3.5 text-muted-foreground" />
          <Label>知识库</Label>
        </div>
        <Link
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          href="/admin/knowledge"
        >
          <Settings2 className="size-3" />
          管理知识库
        </Link>
      </div>

      <Select disabled={loading} onValueChange={onChange} value={value}>
        <SelectTrigger className="w-full">
          <SelectValue
            placeholder={loading ? "加载中..." : "无知识库"}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">
            <span className="text-muted-foreground">无知识库</span>
          </SelectItem>
          {knowledgeBases.map((kb) => (
            <SelectItem key={kb.id} value={kb.id}>
              <span className="flex items-center gap-2">
                {kb.name}
                <span className="text-[11px] text-muted-foreground">
                  {statLabel(kb)}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <p className="text-[11px] text-muted-foreground">
        绑定知识库后，对话时会自动检索相关内容注入上下文（RAG）
      </p>
    </div>
  );
}
