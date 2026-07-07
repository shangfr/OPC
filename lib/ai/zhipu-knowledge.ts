// ============================================================
// 智谱知识库 API 客户端
// 文档: https://docs.bigmodel.cn/api-reference/知识库-api/
// ============================================================

const ZHIPU_KNOWLEDGE_BASE = "https://open.bigmodel.cn/api";

function getApiKey(): string {
  const key = process.env.ZHIPU_API_KEY;
  if (!key) {
    throw new Error("ZHIPU_API_KEY 环境变量未配置");
  }
  return key;
}

function headers(extra?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey()}`,
    ...extra,
  };
}

// ── 通用响应类型 ──

interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  timestamp: number;
  data?: T;
}

// ── 知识库类型 ──

export interface KnowledgeBase {
  id: string;
  embedding_id: number;
  name: string;
  description: string;
  contextual: number;
  background: string;
  icon: string;
  document_size: number;
  length: number;
  word_num: number;
}

export interface KnowledgeListData {
  total: number;
  list: KnowledgeBase[];
}

export interface CreateKnowledgeRequest {
  name: string;
  embedding_id?: number; // 3=Embedding-2, 11=Embedding-3, 12=Embedding-3-pro
  embedding_model?: string;
  description?: string;
  contextual?: number; // 0 or 1
  background?: string;
  icon?: string;
}

export interface EditKnowledgeRequest {
  name?: string;
  embedding_id?: number;
  embedding_model?: string;
  description?: string;
  contextual?: number;
  background?: string;
  icon?: string;
  callback_url?: string;
  callback_header?: Record<string, string>;
}

// ── 文档类型 ──

export interface Document {
  id: string;
  knowledge_type: number;
  custom_separator: string[];
  sentence_size: number;
  length: number;
  word_num: number;
  name: string;
  url: string;
  embedding_stat: string;
  failInfo?: {
    code: number;
    message: string;
  };
}

export interface DocumentListData {
  total: number;
  list: Document[];
}

export interface UploadResult {
  successInfos: Array<{
    documentId: string;
    fileName: string;
  }>;
  failedInfos: Array<{
    fileName: string;
    failReason: string;
  }>;
}

export interface UploadUrlResult {
  successInfos: Array<{
    documentId: string;
    url: string;
  }>;
  failedInfos: Array<{
    url: string;
    failReason: string;
  }>;
}

// ── 检索类型 ──

export interface RetrieveRequest {
  query: string;
  knowledge_ids: string[];
  document_ids?: string[];
  top_k?: number; // 1-20, default 8
  top_n?: number; // 1-100, default 10
  recall_method?: "embedding" | "keyword" | "mixed";
  recall_ratio?: number; // 0-100, default 80 (vector weight in mixed mode)
  rerank_status?: number; // 0=off, 1=on
  rerank_model?: "rerank" | "rerank-pro";
  fractional_threshold?: number; // 0-1
  request_id?: string;
}

export interface RetrieveResult {
  text: string;
  score: number;
  metadata: {
    _id: string;
    knowledge_id: string;
    document_id: string;
    document_name: string;
    document_url: string;
    contextual?: string;
  };
}

export interface KnowledgeUsage {
  used: { word_num: number; length: number };
  total: { word_num: number; length: number };
}

// ============================================================
// API 方法
// ============================================================

// ── 知识库管理 ──

export async function listKnowledgeBases(
  page = 1,
  size = 50
): Promise<ApiResponse<KnowledgeListData>> {
  const url = `${ZHIPU_KNOWLEDGE_BASE}/llm-application/open/knowledge?page=${page}&size=${size}`;
  const res = await fetch(url, {
    method: "GET",
    headers: headers(),
  });
  return res.json();
}

export async function createKnowledgeBase(
  params: CreateKnowledgeRequest
): Promise<ApiResponse<{ id: string }>> {
  const res = await fetch(
    `${ZHIPU_KNOWLEDGE_BASE}/llm-application/open/knowledge`,
    {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        name: params.name,
        embedding_id: params.embedding_id ?? 11, // default Embedding-3
        description: params.description ?? "",
        contextual: params.contextual ?? 0,
        background: params.background ?? "blue",
        icon: params.icon ?? "book",
      }),
    }
  );
  return res.json();
}

export async function getKnowledgeBaseDetail(
  id: string
): Promise<ApiResponse<KnowledgeBase>> {
  const res = await fetch(
    `${ZHIPU_KNOWLEDGE_BASE}/llm-application/open/knowledge/${id}`,
    {
      method: "GET",
      headers: headers(),
    }
  );
  return res.json();
}

export async function editKnowledgeBase(
  id: string,
  params: EditKnowledgeRequest
): Promise<ApiResponse> {
  const res = await fetch(
    `${ZHIPU_KNOWLEDGE_BASE}/llm-application/open/knowledge/${id}`,
    {
      method: "PUT",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify(params),
    }
  );
  return res.json();
}

export async function deleteKnowledgeBase(
  id: string
): Promise<ApiResponse> {
  const res = await fetch(
    `${ZHIPU_KNOWLEDGE_BASE}/llm-application/open/knowledge/${id}`,
    {
      method: "DELETE",
      headers: headers(),
    }
  );
  return res.json();
}

// ── 文档管理 ──

export async function uploadDocument(
  knowledgeId: string,
  file: File | Blob,
  options?: {
    knowledge_type?: number;
    custom_separator?: string[];
    sentence_size?: number;
    parse_image?: boolean;
    word_num_limit?: string;
  }
): Promise<ApiResponse<UploadResult>> {
  const formData = new FormData();
  formData.append("files", file);

  if (options?.knowledge_type !== undefined) {
    formData.append("knowledge_type", String(options.knowledge_type));
  }
  if (options?.custom_separator) {
    formData.append("custom_separator", JSON.stringify(options.custom_separator));
  }
  if (options?.sentence_size !== undefined) {
    formData.append("sentence_size", String(options.sentence_size));
  }
  if (options?.parse_image !== undefined) {
    formData.append("parse_image", String(options.parse_image));
  }
  if (options?.word_num_limit) {
    formData.append("word_num_limit", options.word_num_limit);
  }

  const res = await fetch(
    `${ZHIPU_KNOWLEDGE_BASE}/llm-application/open/document/upload_document/${knowledgeId}`,
    {
      method: "POST",
      headers: headers(),
      body: formData,
    }
  );
  return res.json();
}

export async function uploadUrlDocument(
  knowledgeId: string,
  urls: Array<{
    url: string;
    knowledge_type: number;
    custom_separator?: string[];
    sentence_size?: number;
  }>
): Promise<ApiResponse<UploadUrlResult>> {
  const res = await fetch(
    `${ZHIPU_KNOWLEDGE_BASE}/llm-application/open/document/upload_url`,
    {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        knowledge_id: knowledgeId,
        upload_detail: urls,
      }),
    }
  );
  return res.json();
}

export async function listDocuments(
  knowledgeId: string,
  page = 1,
  size = 50
): Promise<ApiResponse<DocumentListData>> {
  const url = `${ZHIPU_KNOWLEDGE_BASE}/llm-application/open/document?knowledge_id=${knowledgeId}&page=${page}&size=${size}`;
  const res = await fetch(url, {
    method: "GET",
    headers: headers(),
  });
  return res.json();
}

export async function deleteDocument(
  documentId: string
): Promise<ApiResponse> {
  const res = await fetch(
    `${ZHIPU_KNOWLEDGE_BASE}/llm-application/open/document/${documentId}`,
    {
      method: "DELETE",
      headers: headers(),
    }
  );
  return res.json();
}

// ── 检索 ──

export async function retrieve(
  params: RetrieveRequest
): Promise<ApiResponse<RetrieveResult[]>> {
  const res = await fetch(
    `${ZHIPU_KNOWLEDGE_BASE}/llm-application/open/knowledge/retrieve`,
    {
      method: "POST",
      headers: headers({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        query: params.query,
        knowledge_ids: params.knowledge_ids,
        document_ids: params.document_ids,
        top_k: params.top_k ?? 5,
        top_n: params.top_n ?? 10,
        recall_method: params.recall_method ?? "mixed",
        recall_ratio: params.recall_ratio ?? 80,
        rerank_status: params.rerank_status ?? 1,
        rerank_model: params.rerank_model ?? "rerank",
        fractional_threshold: params.fractional_threshold ?? 0.3,
        request_id: params.request_id,
      }),
    }
  );
  return res.json();
}

// ── 使用量 ──

export async function getKnowledgeUsage(): Promise<ApiResponse<KnowledgeUsage>> {
  const res = await fetch(
    `${ZHIPU_KNOWLEDGE_BASE}/llm-application/open/knowledge/capacity`,
    {
      method: "GET",
      headers: headers(),
    }
  );
  return res.json();
}
