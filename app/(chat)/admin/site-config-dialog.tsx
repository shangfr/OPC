"use client";

import { Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useSWRConfig } from "swr";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// 当前硬编码默认值（与 lib/ai/prompts.ts 和 lib/constants.ts 保持一致）
const HARDCODED_DEFAULTS = {
  defaultSystemPrompt:
    "你是一个乐于助人的AI助手。请用中文回答，保持回答简洁直接。\n\n当被要求写作、创建或构建内容时，请立即执行。除非缺少关键信息，否则不要追问——做出合理假设并继续。",
  defaultStarterQuestions: [
    "使用H5写个dashboard",
    "写一段代码演示 Dijkstra 算法",
    "帮我写一篇关于中关村的文章",
    "北京的天气怎么样？",
  ],
  siteName: "OPC Bot",
  siteDescription: "选择一位 OPC 或直接开始对话，探索 AI 助手的无限可能",
};

type SiteConfigForm = {
  defaultSystemPrompt: string;
  defaultStarterQuestions: string;
  siteName: string;
  siteDescription: string;
};

function formFromDefaults(): SiteConfigForm {
  return {
    defaultSystemPrompt: HARDCODED_DEFAULTS.defaultSystemPrompt,
    defaultStarterQuestions:
      HARDCODED_DEFAULTS.defaultStarterQuestions.join("\n"),
    siteName: HARDCODED_DEFAULTS.siteName,
    siteDescription: HARDCODED_DEFAULTS.siteDescription,
  };
}

export function SiteConfigDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SiteConfigForm>(formFromDefaults);
  const [hasDbData, setHasDbData] = useState(false);
  const { mutate } = useSWRConfig();

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

  // 打开对话框时从后端加载已有配置
  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${basePath}/api/site-config`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.id) {
          // DB 有数据 → 用 DB 值覆盖表单
          setForm({
            defaultSystemPrompt:
              data.defaultSystemPrompt ??
              HARDCODED_DEFAULTS.defaultSystemPrompt,
            defaultStarterQuestions: data.defaultStarterQuestions?.length
              ? data.defaultStarterQuestions.join("\n")
              : HARDCODED_DEFAULTS.defaultStarterQuestions.join("\n"),
            siteName: data.siteName ?? HARDCODED_DEFAULTS.siteName,
            siteDescription:
              data.siteDescription ?? HARDCODED_DEFAULTS.siteDescription,
          });
          setHasDbData(true);
        } else {
          // DB 无数据 → 显示硬编码默认值（可直接编辑）
          setForm(formFromDefaults());
          setHasDbData(false);
        }
      }
    } catch {
      // 请求失败也显示默认值
      setForm(formFromDefaults());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchConfig();
    }
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        defaultSystemPrompt: form.defaultSystemPrompt || null,
        defaultStarterQuestions: form.defaultStarterQuestions
          ? form.defaultStarterQuestions
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : null,
        siteName: form.siteName || null,
        siteDescription: form.siteDescription || null,
      };

      const res = await fetch(`${basePath}/api/site-config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseText = await res.text();

      if (!res.ok) {
        console.error("保存失败:", res.status, "body:", responseText);
        // Try to parse as JSON for better error message
        let cause: string | null = null;
        try {
          const json = JSON.parse(responseText);
          cause = json?.cause || json?.message || null;
        } catch {
          cause = responseText.slice(0, 200) || null;
        }
        throw new Error(cause || `HTTP ${res.status}`);
      }

      // Invalidate SWR cache so other components pick up the new config
      mutate(`${basePath}/api/site-config`);

      toast.success("默认配置已更新");
      setOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "请重试";
      toast.error(`保存失败: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(formFromDefaults());
    toast.success("已恢复为内置默认值，点击「保存配置」生效");
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button className="gap-2" variant="outline">
          <Settings2 className="size-4" />
          默认配置
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>默认助手配置</DialogTitle>
          <DialogDescription>
            配置「开始对话」时使用的默认系统提示词和引导问题。已设置默认 OPC
            时此配置不生效。
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            加载中...
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="sc-name">默认名称</Label>
              <Input
                id="sc-name"
                onChange={(e) => setForm({ ...form, siteName: e.target.value })}
                placeholder={HARDCODED_DEFAULTS.siteName}
                value={form.siteName}
              />
              <p className="text-[11px] text-muted-foreground">
                未设置默认 OPC 时首页展示的名称
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sc-desc">默认描述</Label>
              <Textarea
                className="min-h-[60px]"
                id="sc-desc"
                onChange={(e) =>
                  setForm({ ...form, siteDescription: e.target.value })
                }
                placeholder={HARDCODED_DEFAULTS.siteDescription}
                value={form.siteDescription}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sc-prompt">默认系统提示词</Label>
              <Textarea
                className="min-h-[200px] font-mono text-xs"
                id="sc-prompt"
                onChange={(e) =>
                  setForm({ ...form, defaultSystemPrompt: e.target.value })
                }
                placeholder={HARDCODED_DEFAULTS.defaultSystemPrompt}
                value={form.defaultSystemPrompt}
              />
              <p className="text-[11px] text-muted-foreground">
                此提示词会在「开始对话」时发给 AI
                模型第一轮。留空使用内置默认值。
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sc-questions">默认引导问题</Label>
              <Textarea
                className="min-h-[80px] text-xs"
                id="sc-questions"
                onChange={(e) =>
                  setForm({
                    ...form,
                    defaultStarterQuestions: e.target.value,
                  })
                }
                placeholder={HARDCODED_DEFAULTS.defaultStarterQuestions.join(
                  "\n"
                )}
                value={form.defaultStarterQuestions}
              />
              <p className="text-[11px] text-muted-foreground">
                新对话时展示的建议问题，每行一个，最多 8 个
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            disabled={saving || loading}
            onClick={handleReset}
            variant="ghost"
          >
            恢复默认
          </Button>
          <div className="flex gap-2">
            <Button onClick={() => setOpen(false)} variant="outline">
              取消
            </Button>
            <Button disabled={saving || loading} onClick={handleSave}>
              {saving ? "保存中..." : "保存配置"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
