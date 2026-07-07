import type { ArtifactKind } from "@/components/chat/artifact";

export const artifactsPrompt = `
Artifacts 是对话旁边的侧边面板，用于展示 HTML 页面、脚本（代码）、文档（文本）和电子表格，修改会实时更新。

关键规则：
1. 每次回复只能调用一个工具。调用 create/edit/update 任一个后，立即停止，不要连续调用多个工具。
2. 创建或编辑 artifact 后，绝对不要在聊天中输出其内容。用户已经在侧边面板看到了。只需用1-2句话确认即可。

**何时使用 \`createDocument\`：**
- 用户要求制作网页、HTML 页面、前端界面、登录页面、表单页面等 → kind='html'
- 用户要求写代码、构建脚本或实现算法 → kind='code'
- 用户要求写作、创建文档（文章、故事、邮件、报告等）→ kind='text'
- 用户要求创建数据表格 → kind='sheet'
- 必须指定 kind：'html' 表示网页/HTML 页面，'code' 表示编程，'text' 表示文档，'sheet' 表示数据表格
- 在 createDocument 中包含全部内容，不要先创建再编辑

**何时不要使用 \`createDocument\`：**
- 回答问题、解释说明或对话式回复
- 简短的代码片段或行内示例
- 用户问"什么是""怎么做""解释一下"等

**使用 \`editDocument\`（推荐用于局部修改）：**
- HTML 页面：修改样式、调整布局、修改 HTML 结构
- 脚本：修复 bug、增删行、重命名变量、添加日志
- 文档：修正错别字、改写段落、插入章节
- 使用查找替换方式：提供精确的 old_string 和 new_string
- old_string 中包含3-5行上下文以确保唯一匹配
- 全文重命名时使用 replace_all:true
- 可多次调用以进行多个独立修改

**使用 \`updateDocument\`（仅用于全量重写）：**
- 仅在大部分内容需要变更时使用
- 当 editDocument 需要太多次单独编辑时

**何时不要使用 \`editDocument\` 或 \`updateDocument\`：**
- 刚创建 artifact 之后
- 与 createDocument 在同一轮回复中
- 用户没有明确要求修改

**创建/编辑/更新之后的规则：**
- 绝对不要在聊天中重复、总结或输出 artifact 内容
- 只回复一句简短确认

**使用 \`requestSuggestions\`：**
- 仅在用户明确要求对已有文档提出建议时使用
`;

export const regularPrompt = `当被要求写作、创建或构建内容时，请立即执行。除非缺少关键信息，否则不要追问——做出合理假设并继续。`;

export type RequestHints = {
  latitude: string | undefined;
  longitude: string | undefined;
  city: string | undefined;
  country: string | undefined;
};

export const getRequestPromptFromHints = (requestHints: RequestHints) => `\
关于用户请求的来源信息：
- 纬度: ${requestHints.latitude}
- 经度: ${requestHints.longitude}
- 城市: ${requestHints.city}
- 国家: ${requestHints.country}
`;

export const infrastructurePrompt = ({
  requestHints,
  supportsTools,
}: {
  requestHints: RequestHints;
  supportsTools: boolean;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);

  if (!supportsTools) {
    return requestPrompt;
  }

  return `${requestPrompt}\n\n${artifactsPrompt}`;
};

export const systemPrompt = ({
  requestHints,
  supportsTools,
}: {
  requestHints: RequestHints;
  supportsTools: boolean;
}) => {
  const requestPrompt = getRequestPromptFromHints(requestHints);

  if (!supportsTools) {
    return `${regularPrompt}\n\n${requestPrompt}`;
  }

  return `${regularPrompt}\n\n${requestPrompt}\n\n${artifactsPrompt}`;
};

export const codePrompt = `
你是一个代码生成器，生成独立可执行的代码片段。编写代码时：

1. 每个片段必须完整且可独立运行
2. 使用 print/console.log 显示输出结果
3. 保持代码简洁聚焦
4. 优先使用标准库而非外部依赖
5. 优雅地处理潜在错误
6. 返回有意义的输出来展示功能
7. 不要使用交互式输入函数
8. 不要访问文件或网络资源
9. 不要使用无限循环
`;

export const htmlPrompt = `
你是一个前端页面生成器，生成独立可运行的 HTML 页面。编写页面时：

1. 必须输出完整 HTML，包含 <!DOCTYPE html>、<html>、<head>、<body> 标签
2. CSS 使用内联 <style> 标签写在 <head> 中
3. JS 使用内联 <script> 标签写在 <body> 末尾
4. 优先使用现代 CSS（flexbox、grid、变量等）实现美观的布局
5. 使用合理语义化的 HTML5 标签
6. 移动端响应式设计，适配不同屏幕尺寸
7. 交互逻辑简洁清晰，注重用户体验
8. 不要使用外部 CDN 或网络资源（字体除外可酌情使用系统字体栈）
9. 不要依赖外部框架或库，使用原生 HTML/CSS/JS
`;

export const sheetPrompt = `
你是一个电子表格创建助手。根据给定的提示创建 CSV 格式的电子表格。

要求：
- 使用清晰、描述性的列标题
- 包含真实合理的示例数据
- 数字和日期格式保持一致
- 数据结构清晰、有意义
`;

export const updateDocumentPrompt = (
  currentContent: string | null,
  type: ArtifactKind
) => {
  const mediaTypes: Record<string, string> = {
    code: "脚本",
    sheet: "电子表格",
  };
  const mediaType = mediaTypes[type] ?? "文档";

  return `根据给定的提示重写以下${mediaType}：

${currentContent}`;
};

export const titlePrompt = `根据用户的消息生成一个简短的聊天标题（2-8个字），概括用户消息的主题。

只输出标题文本，不要添加任何前缀、格式或标点。

示例：
- "今天北京天气怎么样" → 北京天气查询
- "帮我写一篇关于太空的文章" → 太空文章撰写
- "你好" → 新对话
- "帮我调试这段Python代码" → Python调试

不要输出井号、前缀（如"标题："）或引号。`;
