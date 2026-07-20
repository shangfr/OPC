import type { ArtifactKind } from "@/components/chat/artifact";

// ── 工具规划指令（核心：强制一次性规划，禁止试探性调用）──
const toolPlanningPrompt = `
## 工具调用规则（必须严格遵守）
1. **一次性规划**：收到用户消息后，先判断需要哪些工具，在同一步中全部调用。禁止"调用一个→看结果→再决定调下一个"的试探式调用。
2. **工具选择决策树**（按顺序判断）：
   - 用户要生成网页/代码/文档/表格 → createDocument（一次包含全部内容，不要先创建再编辑）
   - 用户要修改已有文档的局部 → editDocument（查找替换，old_string 含3-5行上下文确保唯一）
   - 用户要全量重写已有文档 → updateDocument（仅大部分内容变更时用）
   - 用户问天气 → getWeather
   - 用户问最新/实时/新闻信息 → webSearch
   - 用户要数学计算/数据处理 → codeInterpreter
   - 用户要画图/生成图片 → generateImage
   - 用户要发短信/短信通知/短信提醒某人 → sendSms（调用前先用一句话向用户确认收件人和内容）
   - 以上都不匹配 → 直接用文字回答，不调用任何工具
3. **调用后行为**：工具返回结果后，用1-2句话总结确认，不要在聊天中重复工具已生成的内容（用户在侧边面板能看到）。
4. **禁止连续调用**：create/edit/update 三者互斥，一轮回复中只调用其中一个，不要连续调用。
`;

// ── Artifact 规则（精简版）──
const artifactsPrompt = `
## Artifact（侧边面板）
createDocument 创建的内容会显示在侧边面板，不要在聊天中重复输出。kind 取值：'html'(网页)、'code'(代码)、'text'(文档)、'sheet'(表格)。
创建后如需修改：局部改动用 editDocument，全量重写用 updateDocument。不要在同一轮中既创建又编辑。
`;

export type RequestHints = {
  latitude: string | undefined;
  longitude: string | undefined;
  city: string | undefined;
  country: string | undefined;
};

export const getRequestPromptFromHints = (requestHints: RequestHints) => `用户位置：${requestHints.city ?? "未知"}, ${requestHints.country ?? "未知"}`;

export const infrastructurePrompt = ({
  requestHints,
  supportsTools,
}: {
  requestHints: RequestHints;
  supportsTools: boolean;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);
  if (!supportsTools) return requestPrompt;
  return `${requestPrompt}\n${artifactsPrompt}`;
};

export const systemPrompt = ({
  requestHints,
  supportsTools,
}: {
  requestHints: RequestHints;
  supportsTools: boolean;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);
  if (!supportsTools) return `被要求创建或构建内容时立即执行，不要追问，做出合理假设并继续。\n\n${requestPrompt}`;
  return `被要求创建或构建内容时立即执行，不要追问，做出合理假设并继续。\n\n${requestPrompt}\n${toolPlanningPrompt}\n${artifactsPrompt}`;
};

export const codePrompt = `生成独立可执行的代码片段。要求：完整可运行、用print/console.log输出、优先用标准库、处理错误、不用交互式输入、不访问文件/网络、不用无限循环。`;

export const htmlPrompt = `生成完整HTML页面。要求：含<!DOCTYPE html>、CSS内联<style>、JS内联<script>、用flexbox/grid布局、语义化标签、响应式、不依赖外部CDN/框架。`;

export const sheetPrompt = `创建CSV电子表格。要求：清晰的列标题、真实合理的示例数据、格式一致。`;

export const updateDocumentPrompt = (
  currentContent: string | null,
  type: ArtifactKind
) => {
  const mediaTypes: Record<string, string> = {
    code: "脚本",
    sheet: "电子表格",
  };
  const mediaType = mediaTypes[type] ?? "文档";
  return `根据给定的提示重写以下${mediaType}：\n\n${currentContent}`;
};

export const titlePrompt = `根据用户消息生成2-8字聊天标题，概括主题。只输出标题文本，无前缀、格式或标点。
示例：
- "今天北京天气怎么样" → 北京天气查询
- "帮我写一篇关于太空的文章" → 太空文章撰写
- "你好" → 新对话`;
