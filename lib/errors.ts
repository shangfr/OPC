export type ErrorType =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limit"
  | "offline";

export type Surface =
  | "chat"
  | "auth"
  | "api"
  | "stream"
  | "database"
  | "history"
  | "vote"
  | "document"
  | "suggestions"
  | "agent"
  | "category"
  | "ticket"
  | "ticket-category"
  | "site-config"
  | "stats"
  | "users"
  | "quota";

export type ErrorCode = `${ErrorType}:${Surface}`;

export type ErrorVisibility = "response" | "log" | "none";

export const visibilityBySurface: Record<Surface, ErrorVisibility> = {
  database: "log",
  chat: "response",
  auth: "response",
  stream: "response",
  api: "response",
  history: "response",
  vote: "response",
  document: "response",
  suggestions: "response",
  agent: "response",
  category: "response",
  ticket: "response",
  "ticket-category": "response",
  "site-config": "response",
  stats: "response",
  users: "response",
  quota: "response",
};

export class ChatbotError extends Error {
  type: ErrorType;
  surface: Surface;
  statusCode: number;

  constructor(errorCode: ErrorCode, cause?: string) {
    super();

    const [type, surface] = errorCode.split(":");

    this.type = type as ErrorType;
    this.cause = cause;
    this.surface = surface as Surface;
    this.message = getMessageByErrorCode(errorCode);
    this.statusCode = getStatusCodeByType(this.type);
  }

  toResponse() {
    const code: ErrorCode = `${this.type}:${this.surface}`;
    const visibility = visibilityBySurface[this.surface];

    const { message, cause, statusCode } = this;

    if (visibility === "log") {
      console.error({
        code,
        message,
        cause,
      });

      return Response.json(
        { code: "", message: "出了点问题，请稍后重试。" },
        { status: statusCode }
      );
    }

    return Response.json({ code, message, cause }, { status: statusCode });
  }
}

export function getMessageByErrorCode(errorCode: ErrorCode): string {
  if (errorCode.includes("database")) {
    return "数据库查询时发生错误。";
  }

  switch (errorCode) {
    case "bad_request:api":
      return "请求无法处理。请检查输入后重试。";

    case "unauthorized:auth":
      return "请先登录后再继续。";
    case "forbidden:auth":
      return "你的账号无权访问此功能。";

    case "rate_limit:chat":
      return "你已达到消息限制。请 1 小时后再来聊天。";
    case "rate_limit:quota":
      return "你的团队本月消息配额已用完。请升级套餐后继续使用。";
    case "not_found:chat":
      return "未找到该对话。请检查对话 ID 后重试。";
    case "forbidden:chat":
      return "该对话属于其他用户。请检查对话 ID 后重试。";
    case "unauthorized:chat":
      return "请先登录以查看此对话。";
    case "offline:chat":
      return "发送消息时遇到问题。请检查网络连接后重试。";

    case "not_found:document":
      return "未找到该文档。请检查文档 ID 后重试。";
    case "forbidden:document":
      return "该文档属于其他用户。请检查文档 ID 后重试。";
    case "unauthorized:document":
      return "请先登录以查看此文档。";
    case "bad_request:document":
      return "创建或更新文档的请求无效。请检查输入后重试。";

    case "unauthorized:agent":
      return "请先登录以访问 Agent 管理。";
    case "forbidden:agent":
      return "当前账号无权访问 Agent 管理。仅管理员可操作。";
    case "not_found:agent":
      return "未找到该 Agent。请检查 ID 后重试。";
    case "bad_request:agent":
      return "Agent 操作请求无效。请检查输入后重试。";

    case "unauthorized:ticket":
      return "请先登录以访问工单管理。";
    case "forbidden:ticket":
      return "当前账号无权操作该工单。";
    case "not_found:ticket":
      return "未找到该工单。请检查 ID 后重试。";
    case "bad_request:ticket":
      return "工单操作请求无效。请检查输入后重试。";

    case "unauthorized:ticket-category":
      return "请先登录以访问工单分类管理。";
    case "forbidden:ticket-category":
      return "当前账号无权操作工单分类。仅管理员可操作。";
    case "not_found:ticket-category":
      return "未找到该工单分类。请检查 ID 后重试。";
    case "bad_request:ticket-category":
      return "工单分类操作请求无效。请检查输入后重试。";

    case "unauthorized:site-config":
      return "请先登录以访问系统配置。";
    case "forbidden:site-config":
      return "当前账号无权修改系统配置。仅管理员可操作。";
    case "bad_request:site-config":
      return "系统配置操作请求无效。请检查输入后重试。";

    case "unauthorized:stats":
      return "请先登录以查看数据看板。";
    case "forbidden:stats":
      return "当前账号无权查看数据看板。仅管理员可操作。";
    case "bad_request:stats":
      return "获取统计数据失败。请稍后重试。";

    case "unauthorized:users":
      return "请先登录以访问用户管理。";
    case "forbidden:users":
      return "当前账号无权访问用户管理。仅管理员可操作。";
    case "not_found:users":
      return "未找到该用户。请检查用户 ID 后重试。";
    case "bad_request:users":
      return "用户操作请求无效。请检查输入后重试。";

    default:
      return "出了点问题，请稍后重试。";
  }
}

function getStatusCodeByType(type: ErrorType) {
  switch (type) {
    case "bad_request":
      return 400;
    case "unauthorized":
      return 401;
    case "forbidden":
      return 403;
    case "not_found":
      return 404;
    case "rate_limit":
      return 429;
    case "offline":
      return 503;
    default:
      return 500;
  }
}
