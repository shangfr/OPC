"use client";
import {
  Activity, CalendarClock, CheckCircle2, Clock, Edit, Eye, Loader2, MapPin,
  Megaphone, MessageSquare, Package, Phone, Send, ShieldCheck, Sparkles, Tag as TagIcon,
  Trash2, User as UserIcon, X, XCircle,
} from "lucide-react";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Ticket, TicketCategory } from "@/lib/db/schema";
import { cn, fetcher } from "@/lib/utils";
import {
  PRIORITY_LABELS, PRIORITY_STYLES, STATUS_LABELS, STATUS_STYLES,
  type TicketPriority, type TicketStatus,
} from "./ticket-shared";

// --- 类型定义 ---
type Comment = {
  id: string;
  ticketId: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: { name?: string | null; image?: string | null };
};
type ActivityLog = {
  id: string;
  ticketId: string;
  userId: string;
  type: string;
  summary: string;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
};
type Tag = { id: string; name: string; color: string; };
type TabKey = "detail" | "match" | "comments" | "activity" | "tags";

// --- 工具函数 ---
const formatDate = (dateStr: string | Date | null | undefined) => {
  if (!dateStr) return "无";
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? "日期格式错误" : d.toLocaleString("zh-CN");
};

// --- 主组件 ---
export function TicketDetailDrawer({
  ticket, categories, open, onOpenChange, onEdit, onDelete, onRefresh, onPublish,
}: {
  ticket: Ticket | null;
  categories: TicketCategory[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: (ticket: Ticket) => void;
  onDelete?: (ticket: Ticket) => void;
  onRefresh?: () => void;
  onPublish?: (ticket: Ticket) => void;
}) {
  const [tab, setTab] = useState<TabKey>("detail");
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [ticketTagIds, setTicketTagIds] = useState<string[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);

  const handleReview = async (reviewStatus: "approved" | "rejected") => {
    if (!ticket) return;
    const note = reviewStatus === "rejected" ? window.prompt("请输入驳回原因（可选）：") || "" : "";
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus, reviewNote: note || undefined }),
      });
      if (!res.ok) throw new Error();
      toast.success(reviewStatus === "approved" ? "审核通过" : "已驳回");
      onOpenChange(false);
      window.dispatchEvent(new CustomEvent("ticket-updated"));
    } catch {
      toast.error("审核操作失败");
    }
  };

  const loadComments = useCallback(async (id: string) => {
    setLoadingComments(true);
    try {
      const data = (await fetcher(`/api/tickets/${id}/comments`)) as Comment[];
      setComments(data);
    } catch {
      setComments([]);
    } finally {
      setLoadingComments(false);
    }
  }, []);

  const loadActivities = useCallback(async (id: string) => {
    setLoadingActivities(true);
    try {
      const data = (await fetcher(`/api/tickets/${id}/activities`)) as ActivityLog[];
      setActivities(data);
    } catch {
      setActivities([]);
    } finally {
      setLoadingActivities(false);
    }
  }, []);

  const loadTags = useCallback(async () => {
    try {
      const data = (await fetcher(`/api/ticket-tags`)) as Tag[];
      setAllTags(data);
    } catch {
      setAllTags([]);
    }
  }, []);

  const loadTicketTags = useCallback(async (id: string) => {
    try {
      const data = (await fetcher(`/api/tickets/${id}/tags`)) as string[];
      setTicketTagIds(data);
    } catch {
      setTicketTagIds([]);
    }
  }, []);

  useEffect(() => {
    if (ticket && open) {
      setTab("detail");
      loadComments(ticket.id);
      loadActivities(ticket.id);
      loadTags();
      loadTicketTags(ticket.id);
    }
  }, [ticket, open, loadComments, loadActivities, loadTags, loadTicketTags]);

  const handlePostComment = async () => {
    if (posting || !ticket || !newComment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/tickets/${ticket.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment.trim() }),
      });
      if (!res.ok) throw new Error();
      const created = (await res.json()) as Comment;
      setComments((prev) => [...prev, created]);
      setNewComment("");
      loadActivities(ticket.id);
      onRefresh?.();
      toast.success("评论已发布");
    } catch {
      toast.error("评论发布失败");
    } finally {
      setPosting(false);
    }
  };

  const handleToggleTag = async (tagId: string) => {
    if (!ticket) return;
    const prevIds = ticketTagIds;
    const next = prevIds.includes(tagId)
      ? prevIds.filter((t) => t !== tagId)
      : [...prevIds, tagId];
    setTicketTagIds(next);
    try {
      await fetch(`/api/tickets/${ticket.id}/tags`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tagIds: next }),
      });
    } catch {
      toast.error("标签更新失败");
      setTicketTagIds(prevIds);
    }
  };

  if (!ticket) return null;

  const category = categories.find((c) => c.id === ticket.categoryId);
  const overdue = ticket.dueDate && new Date(ticket.dueDate) < new Date() && ticket.status !== "completed" && ticket.status !== "closed";

  const tabs: { key: TabKey; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: "detail", label: "详情", icon: <CheckCircle2 className="size-3.5" /> },
    { key: "match", label: "智能匹配", icon: <Sparkles className="size-3.5" /> },
    { key: "comments", label: "评论", icon: <MessageSquare className="size-3.5" />, count: comments.length },
    { key: "activity", label: "活动", icon: <Activity className="size-3.5" />, count: activities.length },
    { key: "tags", label: "标签", icon: <TagIcon className="size-3.5" /> },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        aria-describedby={undefined}
        className="fixed inset-y-0 right-0 left-auto top-0 z-50 flex h-screen w-full max-w-2xl translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-l border-border bg-background p-0 shadow-xl sm:max-w-2xl"
        showCloseButton={false}
      >
        {/* Header */}
        <DialogHeader className="shrink-0 border-b border-border/60 p-5">
          <div className="flex items-start justify-between gap-3 pr-8">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-lg leading-snug">{ticket.title}</DialogTitle>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{ticket.description}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge className={cn("border-0 text-[11px]", STATUS_STYLES[ticket.status as TicketStatus])} variant="secondary">
              {STATUS_LABELS[ticket.status as TicketStatus]}
            </Badge>
            <Badge className={cn("border-0 text-[11px]", PRIORITY_STYLES[ticket.priority as TicketPriority])} variant="secondary">
              {PRIORITY_LABELS[ticket.priority as TicketPriority]}优先级
            </Badge>
            {category && (
              <Badge className="border-0 text-[11px]" style={{ backgroundColor: `${category.color}15`, color: category.color }} variant="secondary">
                {category.name}
              </Badge>
            )}
            {overdue && (
              <Badge className="border-0 bg-destructive/10 text-[11px] text-destructive" variant="secondary">逾期</Badge>
            )}
          </div>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex shrink-0 items-center gap-1 border-b border-border/60 px-3 py-2">
          {tabs.map((t) => (
            <button
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                tab === t.key ? "bg-foreground/5 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              key={t.key}
              onClick={() => setTab(t.key)}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
            >
              {t.icon} {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-0.5 rounded-full bg-foreground/10 px-1.5 text-[10px]">{t.count}</span>
              )}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            {/* 🆕 发布到市场按钮：仅对「已启动但未发布」的工单显示 */}
            {onPublish && ticket && ticket.isActive && (ticket.visibility === "private" || ticket.reviewStatus === "pending") && (
              <Button
                onClick={() => { onPublish(ticket); onOpenChange(false); }}
                size="sm"
                variant="default"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Megaphone className="size-3.5" />
                发布到市场
              </Button>
            )}
            {ticket.reviewStatus === "pending" && (
              <>
                <Button onClick={() => handleReview("approved")} size="sm" variant="outline">
                  <ShieldCheck className="size-3.5" /> 通过
                </Button>
                <Button onClick={() => handleReview("rejected")} size="sm" variant="outline">
                  <XCircle className="size-3.5 text-destructive" /> 驳回
                </Button>
              </>
            )}
            {onEdit && (
              <Button onClick={() => { onEdit(ticket); onOpenChange(false); }} size="sm" variant="ghost">
                <Edit className="size-3.5" /> 编辑
              </Button>
            )}
            {onDelete && (
              <Button onClick={() => { onDelete(ticket); onOpenChange(false); }} size="sm" variant="ghost">
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            )}
            <Button onClick={() => onOpenChange(false)} size="icon-sm" variant="ghost">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        {/* Tab Content - 使用原生 div 实现 100% 可靠的滚动 */}
        <div className="flex-1 overflow-y-auto">
          {tab === "detail" && <DetailTabContent ticket={ticket} overdue={!!overdue} />}
          {tab === "match" && <MatchTabContent ticketId={ticket.id} />}
          {tab === "comments" && (
            <CommentsTabContent
              comments={comments}
              loadingComments={loadingComments}
              posting={posting}
              newComment={newComment}
              setNewComment={setNewComment}
              handlePostComment={handlePostComment}
            />
          )}
          {tab === "activity" && <ActivityTabContent activities={activities} loadingActivities={loadingActivities} />}
          {tab === "tags" && <TagsTabContent allTags={allTags} ticketTagIds={ticketTagIds} handleToggleTag={handleToggleTag} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// --- 子组件：详情 Tab ---
function DetailTabContent({ ticket, overdue }: { ticket: Ticket; overdue: boolean }) {
  return (
    <div className="space-y-4 p-5">
      <DetailField label="描述" value={ticket.description} />
      <StructuredFormCard content={ticket.content} />
      <div className="grid grid-cols-2 gap-3">
        <DetailMeta icon={<UserIcon className="size-3.5" />} label="联系人" value={ticket.contactName || ticket.assignee || "无"} />
        <DetailMeta icon={<Phone className="size-3.5" />} label="手机号" value={ticket.phone || "无"} />
        <DetailMeta icon={<MapPin className="size-3.5" />} label="地区" value={[ticket.province, ticket.city].filter(Boolean).join(" · ") || "未填写"} />
        <DetailMeta icon={<CalendarClock className="size-3.5" />} label="有效期" value={formatDate(ticket.expiryDate)} highlight={!!ticket.expiryDate && new Date(ticket.expiryDate).getTime() < Date.now()} />
        <DetailMeta icon={<CalendarClock className="size-3.5" />} label="截止日期" value={formatDate(ticket.dueDate)} highlight={overdue} />
        <DetailMeta icon={<Clock className="size-3.5" />} label="创建时间" value={formatDate(ticket.createdAt)} />
        <DetailMeta icon={<Activity className="size-3.5" />} label="更新时间" value={formatDate(ticket.updatedAt)} />
        <DetailMeta icon={<Eye className="size-3.5" />} label="浏览量" value={String(ticket.viewCount ?? 0)} />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">进度</span>
          <span className="font-medium">{ticket.progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${ticket.progress}%` }} />
        </div>
      </div>
    </div>
  );
}

// --- 子组件：评论 Tab ---
function CommentsTabContent({ comments, loadingComments, posting, newComment, setNewComment, handlePostComment }: {
  comments: Comment[];
  loadingComments: boolean;
  posting: boolean;
  newComment: string;
  setNewComment: (v: string) => void;
  handlePostComment: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 p-5">
        {loadingComments ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="size-4 animate-spin" /></div>
        ) : comments.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">暂无评论，发表第一条评论吧</div>
        ) : (
          comments.map((c) => (
            <div className="rounded-lg border border-border/50 bg-muted/30 p-3" key={c.id}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium">{c.user?.name || `用户 ${c.userId.slice(0, 6)}`}</span>
                <span className="text-[10px] text-muted-foreground">{formatDate(c.createdAt)}</span>
              </div>
              <p className="whitespace-pre-wrap text-xs leading-relaxed">{c.content}</p>
            </div>
          ))
        )}
      </div>
      <div className="border-t border-border/60 p-4">
        <div className="flex gap-2">
          <Textarea
            className="min-h-[60px] resize-none text-xs"
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePostComment(); }}
            placeholder="输入评论... (Cmd/Ctrl+Enter 发送)"
            value={newComment}
          />
          <Button className="shrink-0" disabled={posting || !newComment.trim()} onClick={handlePostComment} size="icon">
            {posting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

// --- 子组件：活动 Tab ---
function ActivityTabContent({ activities, loadingActivities }: { activities: ActivityLog[]; loadingActivities: boolean }) {
  return (
    <div className="p-5">
      {loadingActivities ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="size-4 animate-spin" /></div>
      ) : activities.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground">暂无活动记录</div>
      ) : (
        <div className="relative space-y-4 pl-4">
          <div className="absolute top-1 bottom-1 left-[5px] w-px bg-border" />
          {activities.map((a) => (
            <div className="relative" key={a.id}>
              <div className="absolute -left-[14px] top-1 size-2.5 rounded-full border-2 border-background bg-primary" />
              <div className="text-xs font-medium">{a.summary}</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">{formatDate(a.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- 子组件：标签 Tab ---
function TagsTabContent({ allTags, ticketTagIds, handleToggleTag }: {
  allTags: Tag[];
  ticketTagIds: string[];
  handleToggleTag: (id: string) => void;
}) {
  return (
    <div className="space-y-4 p-5">
      <div className="text-xs text-muted-foreground">为工单添加标签，支持多维度标记</div>
      <div className="flex flex-wrap gap-2">
        {allTags.length === 0 ? (
          <span className="text-xs text-muted-foreground">暂无标签，请先在管理端创建标签</span>
        ) : (
          allTags.map((tag) => {
            const selected = ticketTagIds.includes(tag.id);
            return (
              <button
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-all",
                  selected ? "border-transparent text-white" : "border-border text-muted-foreground hover:border-foreground/30"
                )}
                key={tag.id}
                onClick={() => handleToggleTag(tag.id)}
                style={selected ? { backgroundColor: tag.color } : undefined}
                type="button"
              >
                {selected && <CheckCircle2 className="size-3" />}
                {tag.name}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// --- 通用展示组件 ---
function DetailField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("text-sm text-foreground", multiline && "whitespace-pre-wrap leading-relaxed")}>{value}</div>
    </div>
  );
}

function DetailMeta({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">{icon} {label}</div>
      <div className={cn("mt-1 truncate text-xs font-medium", highlight && "text-red-600")}>{value}</div>
    </div>
  );
}

// --- 结构化供需表单卡片 ---
interface SupplyDemandForm {
  demand_type?: "supply" | "demand" | null;
  title?: string | null;
  content?: string | null;
  category?: string | null;
  goods_name?: string | null;
  material?: string | null;
  spec?: string | null;
  quantity?: number | string | null;
  month_quantity?: number | string | null;
  price_min?: number | string | null;
  price_max?: number | string | null;
  province?: string | null;
  city?: string | null;
  delivery_days?: number | string | null;
  payment_method?: string | null;
  settlement_method?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  tags?: string[] | null;
}

function StructuredFormCard({ content }: { content: string | null }) {
  const [form, setForm] = useState<SupplyDemandForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [fallbackText, setFallbackText] = useState<string | null>(null);

  useEffect(() => {
    if (!content) return;
    let formUrl: string | null = null;
    let rawText: string | null = null;
    try {
      const meta = JSON.parse(content);
      formUrl = meta?.formSchemaUrl ?? null;
      rawText = meta?.content ?? null;
    } catch {
      setFallbackText(content);
      return;
    }
    if (!formUrl) {
      setFallbackText(rawText ?? content);
      return;
    }
    setLoading(true);
    fetch(`/api/tickets/form-storage?url=${encodeURIComponent(formUrl)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("fetch failed"))))
      .then((data) => setForm(data.form as SupplyDemandForm))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [content]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/20 p-3 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" /> 加载结构化表单...
      </div>
    );
  }

  if (error || (!form && !fallbackText)) return null;

  if (!form && fallbackText) {
    return <DetailField label="详情" value={fallbackText} multiline />;
  }

  const f = form!;
  const isSupply = f.demand_type === "supply";
  const priceText = f.price_min != null && f.price_max != null
    ? `${f.price_min} ~ ${f.price_max} 元`
    : f.price_min != null ? `${f.price_min} 元起` : f.price_max != null ? `≤ ${f.price_max} 元` : null;
  const qtyText = f.quantity != null ? `${f.quantity}${f.month_quantity ? " / 月供 " + f.month_quantity : ""}` : f.month_quantity != null ? `月供 ${f.month_quantity}` : null;
  const locationText = [f.province, f.city].filter(Boolean).join(" · ") || null;

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
          isSupply ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
        )}>
          <Package className="size-3" /> {isSupply ? "供应" : "求购"}
        </span>
        {f.category && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{f.category}</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5 text-xs">
        {f.goods_name && <FormKV icon={<Package className="size-3" />} label="品名" value={String(f.goods_name)} />}
        {f.material && <FormKV label="材质" value={String(f.material)} />}
        {f.spec && <FormKV label="规格" value={String(f.spec)} />}
        {qtyText && <FormKV label="数量" value={qtyText} />}
        {priceText && <FormKV label="价格" value={priceText} highlight />}
        {locationText && <FormKV icon={<MapPin className="size-3" />} label="地区" value={locationText} />}
        {f.delivery_days != null && <FormKV label="交货期" value={`${f.delivery_days} 天`} />}
        {f.payment_method && <FormKV label="付款方式" value={String(f.payment_method)} />}
        {f.settlement_method && <FormKV label="结算方式" value={String(f.settlement_method)} />}
      </div>
      {f.tags && f.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {f.tags.map((t, i) => (
            <span key={i} className="inline-flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              <TagIcon className="size-2.5" /> {t}
            </span>
          ))}
        </div>
      )}
      {f.content && (
        <div className="mt-3 border-t border-border/40 pt-2.5">
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">详细描述</div>
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/80">{f.content}</p>
        </div>
      )}
    </div>
  );
}

function FormKV({ icon, label, value, highlight }: { icon?: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">{icon} {label}</span>
      <span className={cn("font-medium", highlight && "text-primary")}>{value}</span>
    </div>
  );
}

// --- 智能匹配 Tab ---
interface MatchResult {
  ticket: {
    id: string; title: string; description: string; assignee: string | null;
    phone: string | null; status: string; priority: string; createdAt: string; categoryId: string | null;
  };
  form?: SupplyDemandForm | null;
  score: number;
  matchedDimensions: string[];
}

function MatchTabContent({ ticketId }: { ticketId: string }) {
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [sourceType, setSourceType] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/tickets/match?ticketId=${ticketId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("match failed"))))
      .then((data) => {
        setMatches(data.data ?? []);
        setSourceType(data.sourceType ?? null);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [ticketId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="ml-2 text-xs">正在智能匹配供需信息...</span>
      </div>
    );
  }

  if (error) {
    return <div className="py-12 text-center text-xs text-muted-foreground">匹配服务暂时不可用，请稍后重试</div>;
  }

  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
        <Sparkles className="size-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">
          {sourceType ? `暂未找到匹配的${sourceType === "supply" ? "求购" : "供应"}信息` : "当前工单未包含结构化供需表单，无法进行智能匹配"}
        </p>
        <p className="text-[10px] text-muted-foreground/60">建议完善品名、规格、价格等字段以提高匹配率</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" />
        为你找到 <span className="font-semibold text-primary">{matches.length}</span> 条 {sourceType === "supply" ? "求购" : "供应"}匹配信息
      </div>
      {matches.map((m) => <MatchCard key={m.ticket.id} match={m} />)}
    </div>
  );
}

function MatchCard({ match }: { match: MatchResult }) {
  const scoreLevel = match.score >= 70 ? "high" : match.score >= 40 ? "mid" : "low";
  const scoreColor = scoreLevel === "high"
    ? "text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20"
    : scoreLevel === "mid"
    ? "text-amber-600 bg-amber-50 dark:bg-amber-900/20"
    : "text-muted-foreground bg-muted/40";
  const t = match.ticket;

  return (
    <div className="rounded-xl border border-border/60 bg-card p-3.5 transition-colors hover:border-primary/40">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-medium">{t.title}</h4>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{t.description}</p>
        </div>
        <div className={cn("flex flex-col items-center rounded-lg px-2 py-1", scoreColor)}>
          <span className="text-base font-bold leading-none">{match.score}</span>
          <span className="text-[9px]">匹配度</span>
        </div>
      </div>
      {match.matchedDimensions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {match.matchedDimensions.map((d) => (
            <span key={d} className="rounded bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">{d} ✓</span>
          ))}
        </div>
      )}
      {match.form && (
        <div className="grid grid-cols-2 gap-1.5 text-[10px] text-muted-foreground">
          {match.form.goods_name && <span>品名: <span className="text-foreground">{match.form.goods_name}</span></span>}
          {match.form.spec && <span>规格: <span className="text-foreground">{match.form.spec}</span></span>}
          {match.form.province && <span>地区: <span className="text-foreground">{match.form.province}</span></span>}
        </div>
      )}
      {t.phone && (
        <div className="mt-2.5 flex items-center gap-1.5">
          <a href={`tel:${t.phone}`} className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20">
            <Phone className="size-3" /> {t.assignee || "联系对方"}
          </a>
          <a
            href={`sms:${t.phone}?body=${encodeURIComponent(`您好，关于您的工单（${t.title || ""}），我想与您沟通一下。`)}`}
            className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <MessageSquare className="size-3" /> 短信
          </a>
        </div>
      )}
    </div>
  );
}
