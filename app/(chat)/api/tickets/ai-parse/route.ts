// app/(chat)/api/tickets/ai-parse/route.ts
// ============================================================
// AI 智能解析接口：用户输入自然语言需求 → Agent 解析为结构化表单 JSON
//
// 产品流程（PM 视角）：
//   1. 用户在 TicketCards 页面输入自由文本（如"出售山东热轧板5个厚，月供500吨"）
//   2. 调用本接口，由指定的供需解析 Agent 将文本解析为结构化表单
//   3. 返回的表单 JSON 在前端以可编辑结构化表单形式展示
//   4. 用户确认后，表单 JSON 存入 Vercel Blob，并创建分类后的 Ticket
//
// 设计要点：
//   - 复用项目已有的 Agent 体系（agentId 可选，缺省使用内置解析 Prompt）
//   - 使用 generateObject + Zod schema 保证输出结构稳定
//   - 自动推断 demand_type（供应/求购）与 category，用于后续分类匹配
// ============================================================

import { generateObject, generateText } from "ai";
import { z } from "zod";
import { auth } from "@/app/(auth)/auth";
import { getLanguageModel } from "@/lib/ai/providers";
import { DEFAULT_CHAT_MODEL } from "@/lib/ai/models";
import { getAgentById } from "@/lib/db/queries";
import { ChatbotError } from "@/lib/errors";

// ── 结构化表单 Schema（与 SupplyDemandEditor 字段对齐，便于复用） ──
// ⚠️ 注意：.nullable() 只允许值为 null，不允许 key 缺失；
//    .optional() 才允许 key 完全不存在。
//    DeepSeek 等模型通过 openai-compatible 接入时，schema 不会作为 JSON Schema
//    下发给模型，模型可能省略未识别的字段，因此所有非必填字段必须同时
//    .nullable().optional()，否则会触发 ZodError "Required"。
const supplyDemandFormSchema = z.object({
  demand_type: z
    .enum(["supply", "demand"])
    .describe("供需类型：supply=供应/出售，demand=求购/采购"),
  title: z.string().describe("一句话标题，不超过 30 字"),
  content: z.string().describe("供需内容的完整描述"),
  category: z
    .string()
    .nullable()
    .optional()
    .describe("物资类目，如：建材、化工、农副产品、机械设备、电子元器件等"),
  goods_name: z
    .string()
    .nullable()
    .optional()
    .describe("品名，如：热轧板、螺纹钢"),
  material: z
    .string()
    .nullable()
    .optional()
    .describe("材质，如：Q235、304不锈钢"),
  spec: z.string().nullable().optional().describe("规格，如：5mm、Φ12"),
  quantity: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .describe("单次数量"),
  unit: z
    .string()
    .nullable()
    .optional()
    .describe("数量单位，如：吨、件、米"),
  month_quantity: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .describe("月供量"),
  price_min: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .describe("最低价"),
  price_max: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .describe("最高价"),
  price_unit: z
    .string()
    .nullable()
    .optional()
    .describe("价格单位，如：元/吨、元/件"),
  province: z.string().nullable().optional().describe("省份"),
  city: z.string().nullable().optional().describe("城市"),
  delivery_days: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .describe("交货天数"),
  pay_type: z
    .union([z.number(), z.string()])
    .nullable()
    .optional()
    .describe("付款方式：0=现款现货,1=预付20%,2=预付30%,3=货到付款,4=半月结,5=月结30天,6=全款装车"),
  min_order: z
    .string()
    .nullable()
    .optional()
    .describe("最小起订量"),
  contact_name: z.string().nullable().optional().describe("联系人"),
  contact_phone: z.string().nullable().optional().describe("联系电话"),
  tags: z
    .array(z.string())
    .describe("从描述中提取的关键词标签，用于分类匹配，3-8 个"),
});

export type SupplyDemandForm = z.infer<typeof supplyDemandFormSchema>;

// 内置解析 Prompt（当未指定 agentId 时使用）
// ⚠️ DeepSeek 等模型通过 openai-compatible 接入时，schema 不会作为 JSON Schema
//    下发给模型，因此 prompt 必须显式列出所有字段名，否则模型会自创字段名
//    （如 quantity_unit、price），导致 Zod 校验失败。
const BUILTIN_PARSE_PROMPT = `你是一个专业的供需信息解析助手。用户会用自然语言描述供应或求购需求，你需要将其解析为结构化 JSON 表单数据。

【输出格式】
只返回一个 JSON 对象，不要附加任何解释文字、Markdown 标记或代码块。JSON 必须包含以下字段（未提及的字段填 null，但字段名必须全部出现）：

{
  "demand_type": "supply" | "demand",
  "title": "string，不超过 30 字的精炼标题，格式建议 [供应/求购] 品名 规格 数量",
  "content": "string，供需内容的完整描述，可做轻度润色",
  "category": "string|null，物资类目：建材、化工、农副产品、机械设备、电子元器件、纺织服装、能源矿产、其他",
  "goods_name": "string|null，品名，如：热轧板、螺纹钢",
  "material": "string|null，材质，如：Q235、304不锈钢",
  "spec": "string|null，规格，如：5mm、Φ12、5个厚",
  "quantity": "number|string|null，单次数量",
  "unit": "string|null，数量单位，如：吨、件、米（注意字段名是 unit，不是 quantity_unit）",
  "month_quantity": "number|string|null，月供量",
  "price_min": "number|string|null，最低价（注意字段名是 price_min，不是 price）",
  "price_max": "number|string|null，最高价（注意字段名是 price_max，不是 price）",
  "price_unit": "string|null，价格单位，如：元/吨、元/件",
  "province": "string|null，省份，如：山东",
  "city": "string|null，城市，如：济南",
  "delivery_days": "number|string|null，交货天数",
  "pay_type": "string|null，付款方式数字字符串：0=现款现货,1=预付20%,2=预付30%,3=货到付款,4=半月结,5=月结30天,6=全款装车",
  "min_order": "string|null，最小起订量",
  "contact_name": "string|null，联系人",
  "contact_phone": "string|null，联系电话",
  "tags": ["string", "..."],  // 3-8 个关键词标签，用于分类匹配
}

【解析规则】
1. demand_type：出现"出售/供应/现货/批发"等词为 supply；出现"求购/采购/需要/寻"等词为 demand。
2. title：生成不超过 30 字的精炼标题。
3. content：保留用户原始描述的核心信息，可做轻度润色。
4. category：根据品名归入常见类目，无法判断时填 null。
5. 数量字段：单次数量填 quantity，月供量填 month_quantity，单位填 unit（不是 quantity_unit）。
6. 价格字段：单一价格同时填入 price_min 和 price_max；价格区间分别填入；单位填 price_unit。不要使用 price 字段。
7. 地区字段：省份填 province，城市填 city。如"山东济南"→province="山东",city="济南"。
8. pay_type：映射为数字字符串，无法判断时填 null。
9. tags：提取 3-8 个关键词（品名、材质、地区、用途等）。
10. 联系人/电话：如描述中包含则提取，否则填 null。
11. 所有未提及的字段必须显式填 null，不要省略任何字段。

【示例】
输入：出售山东热轧板5个厚，月供500吨，单价4200元/吨，发货地济南，款到发货。
输出：
{"demand_type":"supply","title":"[供应] 热轧板 5个厚 月供500吨","content":"出售山东热轧板5个厚，月供500吨，单价4200元/吨，发货地济南，款到发货。","category":"建材","goods_name":"热轧板","material":null,"spec":"5个厚","quantity":null,"unit":"吨","month_quantity":500,"price_min":4200,"price_max":4200,"price_unit":"元/吨","province":"山东","city":"济南","delivery_days":null,"pay_type":"3","min_order":null,"contact_name":null,"contact_phone":null,"tags":["热轧板","5个厚","山东","济南","钢材"]}`;

const requestBodySchema = z.object({
  text: z.string().min(1, "请输入供需描述").max(5000, "描述最长 5000 字"),
  agentId: z.string().uuid().optional(),
  modelId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return new ChatbotError("unauthorized:ticket").toResponse();
    }

    let body: z.infer<typeof requestBodySchema>;
    try {
      body = requestBodySchema.parse(await request.json());
    } catch {
      return new ChatbotError(
        "bad_request:ticket",
        "请求数据格式不正确，需要 text 字段"
      ).toResponse();
    }

    // 解析 Agent：若指定 agentId 则使用其 systemPrompt，否则使用内置 Prompt
    let systemPrompt = BUILTIN_PARSE_PROMPT;
    let modelId = body.modelId ?? DEFAULT_CHAT_MODEL;

    if (body.agentId) {
      const agent = await getAgentById({ id: body.agentId });
      if (agent?.systemPrompt) {
        systemPrompt = agent.systemPrompt;
      }
    }

    // 调用大模型进行结构化解析
    // 策略：优先使用 generateObject（带 schema 校验）；
    //       若失败（如模型未返回合法 JSON 或字段校验不通过），
    //       降级为 generateText + 手动 JSON 提取 + schema 宽松校验，
    //       兜底保证接口可用性。
    let object: SupplyDemandForm;
    try {
      const result = await generateObject({
        model: getLanguageModel(modelId),
        schema: supplyDemandFormSchema,
        system: systemPrompt,
        prompt: body.text,
      });
      object = result.object;
    } catch (genObjErr) {
      console.warn(
        "[ai-parse] generateObject 失败，降级为 generateText 兜底:",
        genObjErr instanceof Error ? genObjErr.message : genObjErr
      );

      // 降级路径：generateText + 手动 JSON 提取
      const { text } = await generateText({
        model: getLanguageModel(modelId),
        system: systemPrompt,
        prompt: body.text,
      });

      const parsed = extractAndNormalizeJson(text);
      if (!parsed) {
        console.error(
          "[ai-parse] 兜底解析仍失败，原始文本:",
          text?.slice(0, 500)
        );
        throw new ChatbotError(
          "bad_request:ticket",
          "AI 解析失败，请稍后重试或调整描述后重试"
        );
      }

      // 宽松校验：只校验必填字段，其余字段缺失时填 null
      const validation = supplyDemandFormSchema.safeParse(parsed);
      if (validation.success) {
        object = validation.data;
      } else {
        // 必填字段缺失时，补全后再次校验
        const normalized = normalizeForm(parsed);
        const retry = supplyDemandFormSchema.safeParse(normalized);
        if (retry.success) {
          object = retry.data;
        } else {
          console.error(
            "[ai-parse] 兜底数据校验失败:",
            retry.error.issues
          );
          throw new ChatbotError(
            "bad_request:ticket",
            "AI 解析失败，请稍后重试或调整描述后重试"
          );
        }
      }
    }

    // 🆕 智能追问：检测关键字段缺失，生成自然语言追问话术
    const { missingFields, followUpQuestion } = detectMissingFields(object);

    return Response.json(
      {
        success: true,
        data: object,
        rawText: body.text,
        parsedAt: new Date().toISOString(),
        // 🆕 缺失字段列表（前端高亮提示）
        missingFields,
        // 🆕 自然语言追问话术（前端展示给用户，引导补充）
        followUpQuestion,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[ai-parse] 解析失败:", err);
    if (err instanceof ChatbotError) return err.toResponse();
    return new ChatbotError(
      "bad_request:ticket",
      "AI 解析失败，请稍后重试或调整描述后重试"
    ).toResponse();
  }
}

// ── 兜底解析辅助函数 ──

/**
 * 从模型输出文本中提取 JSON 对象。
 * 兼容以下情况：
 *   - 纯 JSON 文本
 *   - 带 ```json ... ``` Markdown 代码块的文本
 *   - JSON 前后混有解释文字的文本
 *   - 模型把字段名写错（如 quantity_unit → unit，price → price_min/price_max）
 */
function extractAndNormalizeJson(text: string): Record<string, unknown> | null {
  if (!text || typeof text !== "string") return null;

  // 1. 去除 Markdown 代码块标记
  const cleaned = text.replace(/```json|```/g, "").trim();

  // 2. 尝试提取第一个 {...} JSON 对象
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }

  // 3. 字段名归一化：把模型常见误用字段名映射到 schema 字段名
  return normalizeForm(parsed);
}

/**
 * 把模型输出的字段名归一化到 schema 定义的字段名。
 * 处理模型常见的字段命名偏差：
 *   - quantity_unit → unit
 *   - price → price_min / price_max（单一价格同时填入两个字段）
 *   - pay_type 数字 → 字符串
 */
function normalizeForm(raw: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };

  // quantity_unit → unit
  if (out.unit === undefined && out.quantity_unit !== undefined) {
    out.unit = out.quantity_unit;
    delete out.quantity_unit;
  }

  // price → price_min & price_max（仅当二者都缺失时）
  if (
    out.price !== undefined &&
    out.price_min === undefined &&
    out.price_max === undefined
  ) {
    out.price_min = out.price;
    out.price_max = out.price;
    delete out.price;
  }

  // pay_type 数字 → 字符串（schema 接受 union，但统一为字符串更稳定）
  if (
    typeof out.pay_type === "number" &&
    !Number.isNaN(out.pay_type)
  ) {
    out.pay_type = String(out.pay_type);
  }

  return out;
}

// ── 智能追问：检测关键字段缺失并生成追问话术 ──
// 产品逻辑：供需信息的完整度直接决定匹配成功率。
// 品名/数量/价格/地区/联系方式是撮合的必要条件，缺失时主动追问。
interface MissingFieldInfo {
  field: string;
  label: string;
  reason: string;
}

function detectMissingFields(form: SupplyDemandForm): {
  missingFields: MissingFieldInfo[];
  followUpQuestion: string | null;
} {
  const missing: MissingFieldInfo[] = [];

  if (!form.goods_name) {
    missing.push({
      field: "goods_name",
      label: "品名",
      reason: "品名是匹配的核心依据，缺失将无法精准撮合",
    });
  }
  if (
    (form.quantity === null || form.quantity === undefined || form.quantity === "") &&
    (form.month_quantity === null || form.month_quantity === undefined || form.month_quantity === "")
  ) {
    missing.push({
      field: "quantity",
      label: "数量",
      reason: "数量是供需撮合的基础信息",
    });
  }
  if (
    (form.price_min === null || form.price_min === undefined || form.price_min === "") &&
    (form.price_max === null || form.price_max === undefined || form.price_max === "")
  ) {
    missing.push({
      field: "price",
      label: "价格",
      reason: "价格区间用于供需双方判断成交可能性",
    });
  }
  if (!form.province) {
    missing.push({
      field: "province",
      label: "地区",
      reason: "地区信息用于就近匹配，降低物流成本",
    });
  }
  if (!form.contact_phone) {
    missing.push({
      field: "contact_phone",
      label: "联系方式",
      reason: "联系方式是对方触达你的必要信息",
    });
  }

  if (missing.length === 0) {
    return { missingFields: [], followUpQuestion: null };
  }

  // 生成自然语言追问话术
  const labels = missing.map((m) => m.label);
  let question: string;
  if (labels.length === 1) {
    question = `为了提高匹配成功率，请补充${labels[0]}信息。`;
  } else if (labels.length === 2) {
    question = `为了提高匹配成功率，请补充${labels[0]}和${labels[1]}信息。`;
  } else {
    const last = labels[labels.length - 1];
    const rest = labels.slice(0, -1).join("、");
    question = `为了提高匹配成功率，请补充${rest}和${last}信息。`;
  }

  return { missingFields: missing, followUpQuestion: question };
}
