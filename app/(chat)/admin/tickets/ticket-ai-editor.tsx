// app/(chat)/admin/tickets/ticket-ai-editor.tsx
// ============================================================
// TicketAIEditor —— AI 智能发布组件（仿 SupplyDemandEditor，嵌入 TicketCards）
//
// 产品流程（PM 视角）：
//   1. 用户在「我的发布」Tab 点击「AI 智能发布」按钮，打开本对话框
//   2. 用户用自然语言描述供需需求（如"出售山东热轧板5个厚，月供500吨"）
//   3. 点击「AI 智能解析」→ 调用 /api/tickets/ai-parse，Agent 解析为结构化表单
//   4. 结构化表单以可编辑字段展示，用户核对/修改
//   5. 点击「确认发布」：
//      a. 表单 JSON 存入 Vercel Blob（/api/tickets/form-storage）→ 得到 formSchemaUrl
//      b. 创建 Ticket（/api/tickets），携带 formSchemaUrl + autoCategoryName
//      c. 后端自动按类目名称匹配/创建分类，完成分类匹配
//   6. 发布成功后关闭对话框，刷新列表，新工单出现在「我的发布」与「服务市场」
// ============================================================

"use client";

import { useState } from "react";
import { Loader2, Sparkles, RefreshCw, Check, FileJson, X, Lightbulb } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// ── 供需结构化表单数据类型（与 SupplyDemandEditor 对齐） ──
interface SupplyDemandData {
  demand_type: "supply" | "demand";
  title: string;
  content: string;
  category: string | null;
  goods_name: string | null;
  material: string | null;
  spec: string | null;
  quantity: number | string | null;
  month_quantity: number | string | null;
  price_min: number | string | null;
  price_max: number | string | null;
  province: string | null;
  city: string | null;
  delivery_days: number | string | null;
  pay_type: number | string | null;
  min_order: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  // 🆕 AI 自动提取的标签（用于精准匹配）
  tags: string[] | null;
}

// 🆕 缺失字段信息（AI 解析后返回）
interface MissingFieldInfo {
  field: string;
  label: string;
  reason: string;
}

// 付款方式字典（与 SupplyDemandEditor 保持一致）
const PAY_TYPE_OPTIONS = [
  { value: "0", label: "现款现货" },
  { value: "1", label: "预付20%" },
  { value: "2", label: "预付30%" },
  { value: "3", label: "货到付款" },
  { value: "4", label: "半月结" },
  { value: "5", label: "月结30天" },
  { value: "6", label: "全款装车" },
];

const EXAMPLE_PROMPTS = [
  "出售山东热轧板5个厚，月供500吨，单价4200元/吨，发货地济南，款到发货，联系人张三 13812345678",
  "求购304不锈钢板 3mm 100吨，上海交货，月结30天，李四 13900001111",
  "供应螺纹钢 HRB400 Φ12 每月2000吨 4100元/吨 北京发货 现款现货",
];

interface TicketAIEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  agentId?: string;
}

export function TicketAIEditor({
  open,
  onOpenChange,
  onSuccess,
  agentId,
}: TicketAIEditorProps) {
  // ── 状态声明 ──
  const [rawText, setRawText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<SupplyDemandData | null>(null);
  // 🆕 AI 智能追问状态
  const [missingFields, setMissingFields] = useState<MissingFieldInfo[]>([]);
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState("");

  // ── 1. 调用 AI 解析接口，将自然语言转为结构化表单 ──
  // supportFollowUp: 是否将用户补充答案拼入原文重新解析
  const handleParse = async (supportFollowUp = false) => {
    let textToParse = rawText;
    if (supportFollowUp && followUpAnswer.trim()) {
      // 将追问补充信息拼入原文，让 AI 在已有上下文基础上补全
      textToParse = `${rawText}\n\n补充信息：${followUpAnswer.trim()}`;
    } else if (!rawText.trim()) {
      toast.error("请输入供需描述");
      return;
    }
    setIsParsing(true);
    setFormData(null);
    setMissingFields([]);
    setFollowUpQuestion(null);
    try {
      const res = await fetch("/api/tickets/ai-parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: textToParse, agentId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `解析失败 (${res.status})`);
      }

      const { data, missingFields: mf, followUpQuestion: fq } = await res.json();

      // 字段安全化：null → 空字符串，避免 React input 报错
      const sanitized: SupplyDemandData = {
        demand_type: data.demand_type || "supply",
        title: data.title || rawText.slice(0, 30),
        content: data.content || "",
        category: data.category || "",
        goods_name: data.goods_name || "",
        material: data.material || "",
        spec: data.spec || "",
        quantity: data.quantity ?? "",
        month_quantity: data.month_quantity ?? "",
        price_min: data.price_min ?? "",
        price_max: data.price_max ?? "",
        province: data.province || "",
        city: data.city || "",
        delivery_days: data.delivery_days ?? "",
        pay_type: data.pay_type ?? "",
        min_order: data.min_order || "",
        contact_name: data.contact_name || "",
        contact_phone: data.contact_phone || "",
        tags: data.tags ?? [],
      };
      setFormData(sanitized);
      setMissingFields(mf ?? []);
      setFollowUpQuestion(fq ?? null);
      setFollowUpAnswer("");
      if (fq) {
        toast.info("AI 已解析，但部分关键信息缺失，请补充");
      } else {
        toast.success("AI 解析完成，请核对信息");
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "AI 解析失败，请重试"
      );
    } finally {
      setIsParsing(false);
    }
  };

  // ── 2. 表单字段变更 ──
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => (prev ? { ...prev, [name]: value } : null));
  };

  // ── 3. 确认发布：表单 JSON → Blob 存储 → 创建 Ticket ──
  const handleSubmit = async () => {
    if (!formData) return;

    // 基础校验
    if (!formData.title?.trim()) {
      toast.error("标题不能为空");
      return;
    }
    if (!formData.content?.trim()) {
      toast.error("发布内容不能为空");
      return;
    }

    setIsSubmitting(true);
    try {
      // Step 1: 表单 JSON 存入 Vercel Blob（向后兼容，作为备份）
      let formSchemaUrl: string | undefined;
      try {
        const storageRes = await fetch("/api/tickets/form-storage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ form: formData }),
        });
        if (storageRes.ok) {
          const blob = await storageRes.json();
          formSchemaUrl = blob.url;
        }
      } catch {
        // Blob 存储失败不阻断流程：新数据优先存 formData（直存 DB）
        console.warn("[ai-editor] Blob 存储失败，降级为 formData 直存 DB");
      }

      // Step 2: 创建 Ticket，携带 formData（直存 DB）+ 新增产品优化字段
      const ticketRes = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          description: formData.content.slice(0, 512),
          content: formData.content,
          priority: "medium",
          status: "pending",
          phone: formData.contact_phone || null,
          // 🆕 AI 解析产出的结构化表单 Blob URL（向后兼容备份）
          formSchemaUrl,
          // 🆕 AI 推断的类目名称，后端自动匹配/创建分类
          autoCategoryName: formData.category || undefined,
          visibility: "private",
          isActive: true,
          // ── 产品优化新增字段 ──
          publishSource: "ai", // 标记为 AI 智能发布
          contactName: formData.contact_name || null,
          province: formData.province || null,
          city: formData.city || null,
          // 结构化表单直存 DB（消除 Vercel Blob 单点依赖）
          formData: formData as unknown as Record<string, unknown>,
          // AI 解析的原始输入文本，便于回溯复检
          aiRawText: rawText || null,
        }),
      });

      if (!ticketRes.ok) {
        const err = await ticketRes.json().catch(() => ({}));
        throw new Error(err.message || "创建工单失败");
      }

      toast.success("发布成功！信息已进入「我的发布」，等待管理员审核");
      // 重置状态
      setFormData(null);
      setRawText("");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "发布失败，请重试"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── 重置 ──
  const handleReset = () => {
    setFormData(null);
    setRawText("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="dialog-mobile-friendly max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            AI 智能发布
          </DialogTitle>
          <DialogDescription>
            用自然语言描述供需需求，AI 自动解析为结构化表单并分类匹配
          </DialogDescription>
        </DialogHeader>

        {/* ═══ 区域 1：自然语言输入 ═══ */}
        {!formData && (
          <div className="space-y-3">
            <textarea
              className="w-full resize-none rounded-lg border border-border/60 bg-muted/30 p-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background"
              rows={5}
              placeholder="例如：出售山东热轧板5个厚，月供500吨，单价4200元/吨，发货地济南，款到发货，联系人张三 13812345678"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />

            {/* 示例快捷输入 */}
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-muted-foreground">
                示例：
              </span>
              {EXAMPLE_PROMPTS.map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  className="touch-target rounded-full bg-muted/60 px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  onClick={() => setRawText(ex)}
                >
                  示例 {i + 1}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleParse(false)}
              disabled={isParsing || !rawText.trim()}
              className="touch-target inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isParsing ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  AI 解析中...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  AI 智能解析
                </>
              )}
            </button>
          </div>
        )}

        {/* ═══ 区域 2：结构化表单核对 ═══ */}
        {formData && (
          <div className="space-y-4">
            {/* 供需类型 + 标题 */}
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                  formData.demand_type === "supply"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-blue-100 text-blue-700"
                )}
              >
                {formData.demand_type === "supply" ? "供应信息" : "求购信息"}
              </span>
              <button
                type="button"
                onClick={() => handleParse(false)}
                disabled={isParsing}
                className="touch-target inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                <RefreshCw className={cn("size-3", isParsing && "animate-spin")} />
                重新解析
              </button>
            </div>

            {/* 🆕 AI 智能追问：关键字段缺失时主动提示用户补充 */}
            {followUpQuestion && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/40 dark:bg-amber-900/10">
                <div className="mb-2 flex items-start gap-2">
                  <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-400">
                      {followUpQuestion}
                    </p>
                    {missingFields.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {missingFields.map((mf) => (
                          <span
                            key={mf.field}
                            className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                            title={mf.reason}
                          >
                            {mf.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={followUpAnswer}
                    onChange={(e) => setFollowUpAnswer(e.target.value)}
                    placeholder="输入补充信息，如：数量500吨，价格4200元/吨，山东济南..."
                    className="flex-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-amber-500 dark:border-amber-700 dark:bg-background"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleParse(true);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleParse(true)}
                    disabled={isParsing || !followUpAnswer.trim()}
                    className="touch-target inline-flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
                  >
                    {isParsing ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Sparkles className="size-3" />
                    )}
                    补充解析
                  </button>
                </div>
              </div>
            )}

            {/* 标题 */}
            <FormField
              label="标题"
              name="title"
              value={formData.title}
              onChange={handleChange}
            />

            {/* 润色后的发布文案 */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                发布文案
              </label>
              <textarea
                name="content"
                className="w-full resize-none rounded-lg border border-border/60 bg-muted/30 p-2.5 text-sm outline-none transition-colors focus:border-primary focus:bg-background"
                rows={3}
                value={formData.content || ""}
                onChange={handleChange}
              />
            </div>

            {/* 交易核心参数 */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <FormField
                label="品名"
                name="goods_name"
                value={formData.goods_name}
                onChange={handleChange}
              />
              <FormField
                label="类目"
                name="category"
                value={formData.category}
                onChange={handleChange}
              />
              <FormField
                label="材质"
                name="material"
                value={formData.material}
                onChange={handleChange}
              />
              <FormField
                label="规格"
                name="spec"
                value={formData.spec}
                onChange={handleChange}
              />
              <FormField
                label="单次数量"
                name="quantity"
                type="number"
                value={formData.quantity}
                onChange={handleChange}
              />
              <FormField
                label="月供量"
                name="month_quantity"
                type="number"
                value={formData.month_quantity}
                onChange={handleChange}
              />
              <FormField
                label="最低价"
                name="price_min"
                type="number"
                value={formData.price_min}
                onChange={handleChange}
              />
              <FormField
                label="最高价"
                name="price_max"
                type="number"
                value={formData.price_max}
                onChange={handleChange}
              />
              <FormField
                label="最小起订量"
                name="min_order"
                value={formData.min_order}
                onChange={handleChange}
              />
            </div>

            {/* 物流与付款 */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <FormField
                label="省份"
                name="province"
                value={formData.province}
                onChange={handleChange}
              />
              <FormField
                label="城市"
                name="city"
                value={formData.city}
                onChange={handleChange}
              />
              <FormField
                label="交货天数"
                name="delivery_days"
                type="number"
                value={formData.delivery_days}
                onChange={handleChange}
              />
              <div className="flex flex-col">
                <label className="mb-1 text-xs font-medium text-muted-foreground">
                  付款方式
                </label>
                <select
                  name="pay_type"
                  className="rounded-lg border border-border/60 bg-background p-2 text-sm outline-none transition-colors focus:border-primary"
                  value={formData.pay_type ?? ""}
                  onChange={handleChange}
                >
                  <option value="">请选择</option>
                  {PAY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 联系人信息 */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                label="联系人"
                name="contact_name"
                value={formData.contact_name}
                onChange={handleChange}
              />
              <FormField
                label="联系电话"
                name="contact_phone"
                value={formData.contact_phone}
                onChange={handleChange}
              />
            </div>

            {/* 🆕 AI 自动提取的标签（可编辑，用于精准匹配） */}
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                标签（用于智能匹配，回车添加）
              </label>
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 p-2">
                {(formData.tags ?? []).map((tag, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs text-primary"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) =>
                          prev
                            ? {
                                ...prev,
                                tags: (prev.tags ?? []).filter((_, i) => i !== idx),
                              }
                            : prev
                        );
                      }}
                      className="text-primary/60 transition-colors hover:text-primary"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder={formData.tags?.length ? "添加标签..." : "如：现货、可议价、含税、月结"}
                  className="min-w-[120px] flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) {
                        setFormData((prev) =>
                          prev
                            ? { ...prev, tags: [...(prev.tags ?? []), val] }
                            : prev
                        );
                        (e.target as HTMLInputElement).value = "";
                      }
                    }
                  }}
                />
              </div>
            </div>

            {/* JSON 预览提示 */}
            <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              <FileJson className="size-3.5" />
              提交后表单将以 JSON 形式存入项目存储桶，并自动归类到「
              {formData.category || "未分类"}」
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {formData ? (
            <>
              <button
                type="button"
                onClick={handleReset}
                disabled={isSubmitting}
                className="touch-target rounded-lg border border-border/50 px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
              >
                重新输入
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="touch-target inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" />
                    发布中...
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" />
                    确认发布
                  </>
                )}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="touch-target rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              取消
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 通用表单字段组件 ──
function FormField({
  label,
  name,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  name: string;
  value: string | number | null | undefined;
  onChange: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => void;
  type?: string;
}) {
  return (
    <div className="flex flex-col">
      <label className="mb-1 text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        type={type}
        name={name}
        className="rounded-lg border border-border/60 bg-background p-2 text-sm outline-none transition-colors focus:border-primary"
        value={value ?? ""}
        onChange={onChange}
      />
    </div>
  );
}
