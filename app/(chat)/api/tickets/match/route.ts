// app/(chat)/api/tickets/match/route.ts
// ============================================================
// 供需智能匹配引擎
//
// 产品逻辑（PM 视角）：
//   供需平台的核心价值是撮合。用户发布一条「供应」后，系统应自动找到
//   对应的「求购」方，反之亦然。本接口基于结构化表单字段做多维度评分：
//
//   评分维度（满分 100）：
//     - 品名匹配    40 分（完全匹配 40 / 包含关系 25 / 模糊相似 10）
//     - 类目匹配    20 分
//     - 规格匹配    15 分
//     - 价格区间重叠 15 分（供需价格区间有交集即得分）
//     - 同省匹配    10 分
//     - 标签重叠    每个共同标签 +5，上限 15 分
//
//   前提条件：双方 demand_type 必须互补（supply ↔ demand）
//   返回 Top N（默认 10）匹配结果，含匹配度与命中维度
// ============================================================

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import {
  getTicketById,
  getVisibleTickets,
  getTicketCategories,
} from "@/lib/db/queries";
import { isAdmin } from "@/lib/utils";
import { ChatbotError } from "@/lib/errors";

// ── 结构化表单类型（与 ai-parse / ticket-ai-editor 对齐） ──
interface SupplyDemandForm {
  demand_type?: "supply" | "demand" | null;
  title?: string | null;
  content?: string | null;
  category?: string | null;
  goods_name?: string | null;
  material?: string | null;
  spec?: string | null;
  quantity?: number | string | null;
  unit?: string | null;
  month_quantity?: number | string | null;
  price_min?: number | string | null;
  price_max?: number | string | null;
  price_unit?: string | null;
  province?: string | null;
  city?: string | null;
  delivery_days?: number | string | null;
  pay_type?: number | string | null;
  min_order?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  tags?: string[] | null;
}

// ── content 字段元信息（创建工单时写入） ──
interface ContentMeta {
  formSchemaUrl?: string;
  autoCategoryName?: string | null;
  content?: string;
}

// ── 匹配结果项 ──
interface MatchResult {
  ticket: {
    id: string;
    title: string;
    description: string;
    assignee: string | null;
    phone: string | null;
    status: string;
    priority: string;
    createdAt: string;
    categoryId: string | null;
  };
  form: SupplyDemandForm | null;
  score: number;
  matchedDimensions: string[];
}

const matchSchema = z.object({
  ticketId: z.string().uuid(),
  limit: z.number().int().min(1).max(50).default(10),
});

// ── 工具：安全解析 content 字段 ──
function parseContentMeta(content: string | null): ContentMeta | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && "formSchemaUrl" in parsed) {
      return parsed as ContentMeta;
    }
  } catch {
    // 非 JSON，是纯文本 content
  }
  return null;
}

// ── 工具：安全解析 formData 字段（DB 列，JSON 字符串） ──
function parseFormData(formData: unknown): SupplyDemandForm | null {
  if (!formData) return null;
  // formData 可能是字符串或已解析对象
  const obj =
    typeof formData === "string" ? safeJsonParse(formData) : formData;
  if (obj && typeof obj === "object") {
    return obj as SupplyDemandForm;
  }
  return null;
}

// ── 工具：安全 JSON 解析 ──
function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ── 工具：从 Blob 拉取表单 JSON ──
async function fetchFormFromBlob(url: string): Promise<SupplyDemandForm | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const form = (await res.json()) as SupplyDemandForm;
    return form;
  } catch {
    return null;
  }
}

/**
 * 解析工单的结构化表单 —— 修复匹配失败的核心函数
 *
 * 优先级（数据驱动 + 容错）：
 *   1. ticket.formData（DB 列，JSON 字符串/对象）—— 最可靠，无需网络请求
 *   2. content 元信息中的 formSchemaUrl + Blob 拉取 —— 兼容旧数据
 *   3. 都没有则返回 null
 *
 * 之前只走第 2 步，导致：
 *   - 手动创建（无 formSchemaUrl）的工单无法匹配
 *   - Blob URL 过期/不可达时匹配全部失败
 *   - 网络抖动导致间歇性匹配失败
 */
async function resolveTicketForm(ticket: {
  formData: unknown;
  content: string | null;
}): Promise<SupplyDemandForm | null> {
  // 1. 优先使用 DB formData 列
  const directForm = parseFormData(ticket.formData);
  if (directForm && directForm.demand_type) {
    return directForm;
  }
  // 2. 回退到 content 元信息 + Blob
  const meta = parseContentMeta(ticket.content);
  if (meta?.formSchemaUrl) {
    const blobForm = await fetchFormFromBlob(meta.formSchemaUrl);
    if (blobForm) return blobForm;
  }
  return null;
}

/**
 * 同步判断工单是否「可能」有结构化表单（用于候选过滤，避免对每个候选都发网络请求）
 * 只要 formData 列有值，或 content 含 formSchemaUrl，即视为候选。
 */
function hasStructuredForm(ticket: {
  formData: unknown;
  content: string | null;
}): boolean {
  if (ticket.formData) {
    const form = parseFormData(ticket.formData);
    if (form && form.demand_type) return true;
  }
  const meta = parseContentMeta(ticket.content);
  return !!meta?.formSchemaUrl;
}

// ── 工具：字符串归一化（去空格/转小写/去单位） ──
function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\s,，。、\-_/\\]+/g, "");
}

// ── 工具：品名相似度评分 ──
function scoreGoodsName(a: string | null | undefined, b: string | null | undefined): { score: number; matched: boolean } {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return { score: 0, matched: false };
  if (na === nb) return { score: 40, matched: true };
  if (na.includes(nb) || nb.includes(na)) return { score: 25, matched: true };
  // 简单字符重叠率 > 60% 视为模糊匹配
  const setA = new Set(na);
  const setB = new Set(nb);
  let common = 0;
  setA.forEach((c) => {
    if (setB.has(c)) common++;
  });
  const overlap = common / Math.max(setA.size, setB.size);
  if (overlap >= 0.6) return { score: 10, matched: true };
  return { score: 0, matched: false };
}

// ── 工具：规格匹配 ──
function scoreSpec(a: string | null | undefined, b: string | null | undefined): { score: number; matched: boolean } {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return { score: 0, matched: false };
  if (na === nb) return { score: 15, matched: true };
  if (na.includes(nb) || nb.includes(na)) return { score: 10, matched: true };
  return { score: 0, matched: false };
}

// ── 工具：价格区间重叠 ──
function scorePriceOverlap(
  aMin: number | string | null | undefined,
  aMax: number | string | null | undefined,
  bMin: number | string | null | undefined,
  bMax: number | string | null | undefined
): { score: number; matched: boolean } {
  const aLo = Number(aMin);
  const aHi = Number(aMax);
  const bLo = Number(bMin);
  const bHi = Number(bMax);
  // 至少一方有价格区间才评分
  const aHas = (!isNaN(aLo) || !isNaN(aHi)) && (aLo > 0 || aHi > 0);
  const bHas = (!isNaN(bLo) || !isNaN(bHi)) && (bLo > 0 || bHi > 0);
  if (!aHas || !bHas) return { score: 0, matched: false };

  const lo1 = isNaN(aLo) ? 0 : aLo;
  const hi1 = isNaN(aHi) ? Infinity : aHi;
  const lo2 = isNaN(bLo) ? 0 : bLo;
  const hi2 = isNaN(bHi) ? Infinity : bHi;

  // 区间有交集
  if (lo1 <= hi2 && lo2 <= hi1) return { score: 15, matched: true };
  return { score: 0, matched: false };
}

// ── 工具：省份匹配 ──
function scoreProvince(a: string | null | undefined, b: string | null | undefined): { score: number; matched: boolean } {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return { score: 0, matched: false };
  if (na === nb || na.includes(nb) || nb.includes(na)) return { score: 10, matched: true };
  return { score: 0, matched: false };
}

// ── 工具：标签重叠 ──
function scoreTags(a: string[] | null | undefined, b: string[] | null | undefined): { score: number; matched: boolean } {
  if (!a || !b || a.length === 0 || b.length === 0) return { score: 0, matched: false };
  const setA = new Set(a.map(normalize).filter(Boolean));
  const setB = new Set(b.map(normalize).filter(Boolean));
  let common = 0;
  setA.forEach((t) => {
    if (setB.has(t)) common++;
  });
  if (common === 0) return { score: 0, matched: false };
  return { score: Math.min(common * 5, 15), matched: true };
}

// ── 主匹配函数 ──
async function findMatches(
  sourceTicket: NonNullable<Awaited<ReturnType<typeof getTicketById>>>,
  sourceForm: SupplyDemandForm | null,
  categories: Awaited<ReturnType<typeof getTicketCategories>>,
  userId: string,
  userIsAdmin: boolean,
  limit: number
): Promise<MatchResult[]> {
  if (!sourceForm || !sourceForm.demand_type) return [];

  // 目标类型必须互补
  const targetType = sourceForm.demand_type === "supply" ? "demand" : "supply";

  // 拉取所有可见工单
  const allTickets = await getVisibleTickets({ userId, userIsAdmin });

  // 过滤：类型互补 + 活跃 + 非自己 + 有结构化表单
  // 🆕 修复：使用 hasStructuredForm 同时检查 formData 列和 content 元信息，
  //        避免遗漏手动创建（无 formSchemaUrl）的工单
  const candidates = allTickets.filter((t) => {
    if (t.id === sourceTicket.id) return false;
    if (!t.isActive) return false;
    if (t.status === "closed" || t.status === "completed") return false;
    return hasStructuredForm(t);
  });

  // 并发解析候选表单 —— 优先用 DB formData 列，回退 Blob
  const formsWithTickets = await Promise.all(
    candidates.map(async (t) => {
      const form = await resolveTicketForm(t);
      return { ticket: t, form };
    })
  );

  // 过滤出目标类型
  const targetCandidates = formsWithTickets.filter(
    (x) => x.form?.demand_type === targetType
  );

  const results: MatchResult[] = [];

  for (const { ticket: cand, form } of targetCandidates) {
    if (!form) continue;

    const dims: string[] = [];
    let score = 0;

    // 品名
    const gn = scoreGoodsName(sourceForm.goods_name, form.goods_name);
    if (gn.matched) {
      score += gn.score;
      dims.push("品名");
    }

    // 类目（通过 categoryId 查名称比对，或直接比对 form.category）
    const srcCatName =
      sourceForm.category ||
      categories.find((c) => c.id === sourceTicket.categoryId)?.name ||
      "";
    const candCatName =
      form.category ||
      categories.find((c) => c.id === cand.categoryId)?.name ||
      "";
    if (srcCatName && candCatName && normalize(srcCatName) === normalize(candCatName)) {
      score += 20;
      dims.push("类目");
    }

    // 规格
    const sp = scoreSpec(sourceForm.spec, form.spec);
    if (sp.matched) {
      score += sp.score;
      dims.push("规格");
    }

    // 价格区间
    const pr = scorePriceOverlap(
      sourceForm.price_min,
      sourceForm.price_max,
      form.price_min,
      form.price_max
    );
    if (pr.matched) {
      score += pr.score;
      dims.push("价格");
    }

    // 省份
    const pv = scoreProvince(sourceForm.province, form.province);
    if (pv.matched) {
      score += pv.score;
      dims.push("地区");
    }

    // 标签
    const tg = scoreTags(sourceForm.tags, form.tags);
    if (tg.matched) {
      score += tg.score;
      dims.push("标签");
    }

    // 至少有一个维度命中才纳入结果
    if (score > 0) {
      results.push({
        ticket: {
          id: cand.id,
          title: cand.title,
          description: cand.description,
          assignee: cand.assignee,
          phone: cand.phone,
          status: cand.status,
          priority: cand.priority,
          createdAt: cand.createdAt.toISOString(),
          categoryId: cand.categoryId,
        },
        form,
        score,
        matchedDimensions: dims,
      });
    }
  }

  // 按匹配度降序
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

// ── POST /api/tickets/match ──
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatbotError("unauthorized:ticket").toResponse();
    }

    let body: z.infer<typeof matchSchema>;
    try {
      body = matchSchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:ticket",
        "参数格式不正确，需要 ticketId"
      ).toResponse();
    }

    const sourceTicket = await getTicketById({ id: body.ticketId });
    if (!sourceTicket) {
      return new ChatbotError("not_found:ticket", "工单不存在").toResponse();
    }

    // 权限：仅创建者或管理员可查看匹配
    const userIsAdmin = isAdmin(session.user);
    if (sourceTicket.userId !== session.user.id && !userIsAdmin) {
      return new ChatbotError("forbidden:ticket", "无权查看此工单的匹配结果").toResponse();
    }

    // 拉取源工单表单 —— 🆕 修复：优先用 DB formData 列，回退 Blob
    const sourceForm = await resolveTicketForm(sourceTicket);

    if (!sourceForm || !sourceForm.demand_type) {
      return NextResponse.json(
        {
          success: true,
          data: [],
          message: "当前工单未包含结构化供需表单，无法进行智能匹配",
        },
        { status: 200 }
      );
    }

    const categories = await getTicketCategories();
    const matches = await findMatches(
      sourceTicket,
      sourceForm,
      categories,
      session.user.id,
      userIsAdmin,
      body.limit
    );

    return NextResponse.json(
      {
        success: true,
        data: matches,
        sourceType: sourceForm.demand_type,
        total: matches.length,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[tickets/match] 匹配失败:", err);
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket", "智能匹配失败，请稍后重试").toResponse();
  }
}

// ── GET /api/tickets/match?ticketId=xxx ──
// 详情抽屉通过 GET 拉取匹配结果
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatbotError("unauthorized:ticket").toResponse();
    }

    const { searchParams } = new URL(request.url);
    const ticketId = searchParams.get("ticketId");
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (!ticketId) {
      return new ChatbotError("bad_request:ticket", "缺少参数 ticketId").toResponse();
    }

    const sourceTicket = await getTicketById({ id: ticketId });
    if (!sourceTicket) {
      return new ChatbotError("not_found:ticket", "工单不存在").toResponse();
    }

    const userIsAdmin = isAdmin(session.user);
    if (sourceTicket.userId !== session.user.id && !userIsAdmin) {
      return new ChatbotError("forbidden:ticket", "无权查看此工单的匹配结果").toResponse();
    }

    // 🆕 修复：优先用 DB formData 列，回退 Blob
    const sourceForm = await resolveTicketForm(sourceTicket);

    if (!sourceForm || !sourceForm.demand_type) {
      return NextResponse.json(
        {
          success: true,
          data: [],
          sourceType: null,
          message: "当前工单未包含结构化供需表单，无法进行智能匹配",
        },
        { status: 200 }
      );
    }

    const categories = await getTicketCategories();
    const matches = await findMatches(
      sourceTicket,
      sourceForm,
      categories,
      session.user.id,
      userIsAdmin,
      limit
    );

    return NextResponse.json(
      {
        success: true,
        data: matches,
        sourceType: sourceForm.demand_type,
        total: matches.length,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[tickets/match] GET 匹配失败:", err);
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError("bad_request:ticket", "智能匹配失败，请稍后重试").toResponse();
  }
}
