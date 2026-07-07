import { type InferSelectModel, sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  index,
  integer,
  json,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// 用户角色枚举
export const userRoleEnum = pgEnum("user_role", ["user", "moderator", "admin"]);

// ============================================================
// SaaS 多租户：团队角色枚举（owner / admin / member）
// ============================================================
export const teamRoleEnum = pgEnum("team_role", ["owner", "admin", "member"]);

// 邀请状态枚举
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
]);

// 订阅状态枚举（与 Stripe 状态对齐）
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
]);

// ============================================================
// OPC 交易市场：账号类型 / 企业认证 / OPC 所有权 / 上架审核 / 订阅
// ============================================================

// 账号类型：personal=个人创作者(2C)，enterprise=企业(2B)
export const accountTypeEnum = pgEnum("account_type", ["personal", "enterprise"]);

// 企业认证状态
export const enterpriseVerifyStatusEnum = pgEnum("enterprise_verify_status", [
  "unverified", // 未认证
  "pending", // 认证审核中
  "verified", // 已认证
  "rejected", // 认证驳回
]);

// OPC 所有权类型（三态）
export const opcOwnershipTypeEnum = pgEnum("opc_ownership_type", [
  "personal_private", // 个人私有（创作者自建，仅自己可见）
  "enterprise_private", // 企业私有（企业自建，仅本企业内部）
  "public", // 平台公共（全平台企业可订阅）
]);

// OPC 所有者主体类型
export const opcOwnerTypeEnum = pgEnum("opc_owner_type", [
  "user", // 个人创作者
  "enterprise", // 企业
  "platform", // 平台官方
]);

// OPC 上架状态（流转状态机）
export const opcListingStatusEnum = pgEnum("opc_listing_status", [
  "private", // 私有（个人/企业）
  "pending", // 上架申请审核中
  "listed", // 已上架公共库
  "delisted", // 已下架（已订阅企业可用到周期结束）
]);

// 上架申请审核状态
export const listingApplicationStatusEnum = pgEnum("listing_application_status", [
  "pending", // 待审核
  "approved", // 审核通过
  "rejected", // 审核驳回
  "withdrawn", // 申请人撤回
]);

// OPC 订阅状态
export const opcSubscriptionStatusEnum = pgEnum("opc_subscription_status", [
  "active", // 生效中
  "expired", // 已到期
  "canceled", // 已取消
]);

export const user = pgTable(
  "User",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    email: varchar("email", { length: 64 }).notNull(),
    password: varchar("password", { length: 64 }),
    name: text("name"),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
    isAnonymous: boolean("isAnonymous").notNull().default(false),
    role: userRoleEnum("role").notNull().default("user"),
    // 手机号字段：支持手机号注册登录，可选（邮箱注册用户可为空）
    phone: varchar("phone", { length: 20 }),
    // OPC 交易市场：账号类型 personal=个人创作者(2C) / enterprise=企业(2B)
    accountType: accountTypeEnum("accountType").notNull().default("personal"),
    // 企业账号所属企业 ID（个人账号为 null；企业成员子账号指向所属企业）
    // Drizzle 的 .references() 使用函数回调，可安全前向引用 enterprise 表
    enterpriseId: uuid("enterpriseId").references(() => enterprise.id, {
      onDelete: "set null",
    }),
    // 账号封禁标记（风控用）
    bannedAt: timestamp("bannedAt"),
    bannedReason: text("bannedReason"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("User_email_idx").on(table.email),
    // 手机号唯一索引（部分索引，仅当 phone 非空时生效，避免多个 NULL 冲突）
    phoneIdx: uniqueIndex("User_phone_idx").on(table.phone).where(sql`${table.phone} IS NOT NULL`),
    accountTypeIdx: index("User_accountType_idx").on(table.accountType),
    enterpriseIdIdx: index("User_enterpriseId_idx").on(table.enterpriseId),
  })
);

export type User = InferSelectModel<typeof user>;

export const chat = pgTable(
  "Chat",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    visibility: varchar("visibility", { enum: ["public", "private"] })
      .notNull()
      .default("private"),
    agentId: uuid("agentId").references(() => agent.id, {
      onDelete: "set null",
    }),
    agentName: text("agentName"),
    pinnedAt: timestamp("pinnedAt"),
    // SaaS 多租户：所属团队 ID（用于租户隔离）
    teamId: uuid("teamId").references(() => team.id, {
      onDelete: "set null",
    }),
  },
  (table) => ({
    userIdIdx: index("Chat_userId_idx").on(table.userId),
    createdAtIdx: index("Chat_createdAt_idx").on(table.createdAt),
    pinnedAtIdx: index("Chat_pinnedAt_idx").on(table.pinnedAt),
    teamIdIdx: index("Chat_teamId_idx").on(table.teamId),
  })
);

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable(
  "Message_v2",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    role: varchar("role").notNull(),
    parts: json("parts").notNull(),
    attachments: json("attachments").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    chatIdIdx: index("Message_chatId_idx").on(table.chatId),
    createdAtIdx: index("Message_createdAt_idx").on(table.createdAt),
  })
);

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "Vote_v2",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("text", { enum: ["text", "code", "image", "html", "sheet"] })
      .notNull()
      .default("text"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
  })
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
  "Stream",
  {
    id: uuid("id").notNull().defaultRandom(),
    chatId: uuid("chatId").notNull(),
    createdAt: timestamp("createdAt").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    chatRef: foreignKey({
      columns: [table.chatId],
      foreignColumns: [chat.id],
    }).onDelete("cascade"),
  })
);

export type Stream = InferSelectModel<typeof stream>;

// Agent 可见性枚举：public=全站公开（管理员创建）, private=仅创建者可见
export const agentVisibilityEnum = pgEnum("agent_visibility", [
  "public",
  "private",
]);

export const agent = pgTable(
  "Agent",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    avatar: text("avatar").notNull().default("/icon.png"),
    systemPrompt: text("system_prompt").notNull(),
    phone: text("phone"),
    knowledgeId: text("knowledge_id"),
    starterQuestions: json("starter_questions").$type<string[]>().default([]),
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    categoryId: uuid("categoryId").references(() => category.id, {
      onDelete: "set null",
    }),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // 可见性：public=全站可见（管理员创建的公共OPC），private=仅创建者可见（用户自建OPC）
    visibility: agentVisibilityEnum("visibility").notNull().default("public"),
    // SaaS 多租户：所属团队 ID（private Agent 归属团队，public Agent 可为空）
    teamId: uuid("teamId").references(() => team.id, {
      onDelete: "set null",
    }),
    // === OPC 交易市场：三态所有权模型 ===
    // 所有权类型：personal_private / enterprise_private / public
    ownershipType: opcOwnershipTypeEnum("ownershipType")
      .notNull()
      .default("personal_private"),
    // 所有者主体类型：user(个人创作者) / enterprise(企业) / platform(平台官方)
    ownerType: opcOwnerTypeEnum("ownerType").notNull().default("user"),
    // 所有者企业 ID（ownerType=enterprise 时指向企业；user/platform 时为 null）
    ownerEnterpriseId: uuid("ownerEnterpriseId").references(() => enterprise.id, {
      onDelete: "set null",
    }),
    // 上架状态：private / pending / listed / delisted
    listingStatus: opcListingStatusEnum("listingStatus")
      .notNull()
      .default("private"),
    // 订阅价格（分）：月度 / 年度（listed 公共 OPC 的雇佣价格，0=免费）
    priceMonthly: integer("priceMonthly").notNull().default(0),
    priceYearly: integer("priceYearly").notNull().default(0),
    // 上架时间（转为 listed 时记录）
    listedAt: timestamp("listedAt"),
    // 强制下架审计字段：谁在何时因何种原因下架（管理员风控）
    delistedAt: timestamp("delistedAt"),
    delistedBy: uuid("delistedBy").references(() => user.id, {
      onDelete: "set null",
    }),
    // 订阅副本来源：企业订阅公共 OPC 后复制一份独立副本，
    // 此字段指向原始公共 OPC 的 ID（null 表示非副本）
    sourceAgentId: uuid("sourceAgentId").references(() => agent.id, {
      onDelete: "set null",
    }),
    delistReason: text("delistReason"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    defaultUnique: uniqueIndex("agent_default_idx")
      .on(table.isDefault)
      .where(sql`${table.isDefault} = true`),
    userIdIdx: index("agent_userId_idx").on(table.userId),
    visibilityIdx: index("agent_visibility_idx").on(table.visibility),
    teamIdIdx: index("agent_teamId_idx").on(table.teamId),
    ownershipTypeIdx: index("agent_ownershipType_idx").on(table.ownershipType),
    listingStatusIdx: index("agent_listingStatus_idx").on(table.listingStatus),
    ownerEnterpriseIdIdx: index("agent_ownerEnterpriseId_idx").on(
      table.ownerEnterpriseId
    ),
  })
);

export type Agent = InferSelectModel<typeof agent>;

export const category = pgTable("Category", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  sortOrder: integer("sort_order").notNull().default(0),
  colorKey: text("color_key").notNull().default("indigo"),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type Category = InferSelectModel<typeof category>;

// ============================================================
// 工单（Ticket）系统 —— 复刻 OPC 的分组+卡片模式，面向任务管理场景
// ============================================================

// 工单优先级枚举
export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low", // 低
  "medium", // 中
  "high", // 高
  "urgent", // 紧急
]);

// 工单状态枚举（工单生命周期）
export const ticketStatusEnum = pgEnum("ticket_status", [
  "pending", // 待处理
  "in_progress", // 进行中
  "completed", // 已完成
  "closed", // 已关闭
]);

// 工单可见性枚举：与 Agent 保持一致
export const ticketVisibilityEnum = pgEnum("ticket_visibility", [
  "public",
  "private",
]);

// 工单发布来源枚举：区分 AI 智能发布与手动发布
export const ticketPublishSourceEnum = pgEnum("ticket_publish_source", [
  "ai", // AI 智能发布
  "manual", // 手动发布
]);

// 工单审核状态枚举：管理员审核工作流
export const ticketReviewStatusEnum = pgEnum("ticket_review_status", [
  "pending", // 待审核
  "approved", // 已通过
  "rejected", // 已驳回
]);

// 工单分类表（任务类型分类，对应 OPC 的 Category 分组）
export const ticketCategory = pgTable("TicketCategory", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  sortOrder: integer("sort_order").notNull().default(0),
  colorKey: text("color_key").notNull().default("indigo"),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type TicketCategory = InferSelectModel<typeof ticketCategory>;

// 工单表（对应 OPC 的 Agent 表，扩展了优先级/状态/负责人/截止日期等任务管理字段）
export const ticket = pgTable(
  "Ticket",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    // 任务详情/验收标准等富文本说明
    content: text("content"),
    // 优先级：low/medium/high/urgent
    priority: ticketPriorityEnum("priority").notNull().default("medium"),
    // 状态：pending/in_progress/completed/closed
    status: ticketStatusEnum("status").notNull().default("pending"),
    // 进度百分比 0-100
    progress: integer("progress").notNull().default(0),
    // 负责人姓名（自由文本，便于灵活指派）
    assignee: text("assignee"),
    // 负责人手机号
    phone: text("phone"),
    // 截止日期
    dueDate: timestamp("due_date"),
    // 关联分类（任务类型）
    categoryId: uuid("categoryId").references(() => ticketCategory.id, {
      onDelete: "set null",
    }),
    // 创建者
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // 可见性：public=全站可见，private=仅创建者可见
    visibility: ticketVisibilityEnum("visibility")
      .notNull()
      .default("public"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),

    // ── 产品优化扩展字段 ──
    // 发布来源：ai=AI 智能发布，manual=手动发布（默认 manual）
    publishSource: ticketPublishSourceEnum("publish_source")
      .notNull()
      .default("manual"),
    // 审核状态：pending/approved/rejected（默认 approved，兼容旧逻辑：管理员直发即通过）
    reviewStatus: ticketReviewStatusEnum("review_status")
      .notNull()
      .default("approved"),
    // 审核人
    reviewedById: uuid("reviewed_by_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // 审核时间
    reviewedAt: timestamp("reviewed_at"),
    // 驳回原因 / 审核备注
    reviewNote: text("review_note"),
    // 浏览量（供需信息的热度指标）
    viewCount: integer("view_count").notNull().default(0),
    // 信息有效期（供需信息有时效性，过期自动下架）
    expiryDate: timestamp("expiry_date"),
    // 联系人姓名（与 phone 配对，完整联系方式）
    contactName: text("contact_name"),
    // 省份 / 城市（供需信息的地理位置，便于区域筛选）
    province: text("province"),
    city: text("city"),
    // 结构化表单 JSON（直接存 DB，消除 Vercel Blob 外部依赖）
    formData: jsonb("form_data"),
    // AI 解析的原始输入文本（便于回溯与复检）
    aiRawText: text("ai_raw_text"),
    // 软删除标记（保留数据可恢复，避免硬删除丢失）
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    userIdIdx: index("ticket_userId_idx").on(table.userId),
    statusIdx: index("ticket_status_idx").on(table.status),
    priorityIdx: index("ticket_priority_idx").on(table.priority),
    visibilityIdx: index("ticket_visibility_idx").on(table.visibility),
    dueDateIdx: index("ticket_due_date_idx").on(table.dueDate),
    publishSourceIdx: index("ticket_publish_source_idx").on(
      table.publishSource,
    ),
    reviewStatusIdx: index("ticket_review_status_idx").on(table.reviewStatus),
    expiryDateIdx: index("ticket_expiry_date_idx").on(table.expiryDate),
    isDeletedIdx: index("ticket_is_deleted_idx").on(table.isDeleted),
  }),
);

export type Ticket = InferSelectModel<typeof ticket>;

// ============================================================
// 工单系统产品优化扩展表
// ============================================================

// 工单评论表 —— 支持多用户协作讨论
export const ticketComment = pgTable("TicketComment", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  ticketId: uuid("ticketId")
    .notNull()
    .references(() => ticket.id, { onDelete: "cascade" }),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type TicketComment = InferSelectModel<typeof ticketComment>;

// 活动日志类型枚举
export const ticketActivityTypeEnum = pgEnum("ticket_activity_type", [
  "created", // 工单创建
  "updated", // 字段更新
  "status_changed", // 状态变更
  "priority_changed", // 优先级变更
  "assignee_changed", // 负责人变更
  "commented", // 评论
  "deleted", // 删除
  "reviewed", // 🆕 审核（通过/驳回/发布）
]);

// 工单活动日志表 —— 自动记录所有关键操作，便于追溯
export const ticketActivity = pgTable("TicketActivity", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  ticketId: uuid("ticketId")
    .notNull()
    .references(() => ticket.id, { onDelete: "cascade" }),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: ticketActivityTypeEnum("type").notNull(),
  // 变更摘要，如 "状态: 待处理 → 进行中"
  summary: text("summary").notNull(),
  // 变更前值（JSON 字符串）
  oldValue: text("old_value"),
  // 变更后值（JSON 字符串）
  newValue: text("new_value"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type TicketActivity = InferSelectModel<typeof ticketActivity>;

// 工单标签表 —— 多维度标记，弥补分类单选的不足
export const ticketTag = pgTable("TicketTag", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type TicketTag = InferSelectModel<typeof ticketTag>;

// 工单-标签多对多关联表
export const ticketTagRelation = pgTable(
  "TicketTagRelation",
  {
    ticketId: uuid("ticketId")
      .notNull()
      .references(() => ticket.id, { onDelete: "cascade" }),
    tagId: uuid("tagId")
      .notNull()
      .references(() => ticketTag.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.ticketId, table.tagId] }),
    ticketIdx: index("ticket_tag_relation_ticket_idx").on(table.ticketId),
    tagIdx: index("ticket_tag_relation_tag_idx").on(table.tagId),
  }),
);

export type TicketTagRelation = InferSelectModel<typeof ticketTagRelation>;

export const siteConfig = pgTable("SiteConfig", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  defaultSystemPrompt: text("default_system_prompt"),
  defaultStarterQuestions: json("default_starter_questions").$type<string[]>(),
  siteName: text("site_name"),
  siteDescription: text("site_description"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type SiteConfig = InferSelectModel<typeof siteConfig>;

export const passwordResetToken = pgTable("PasswordResetToken", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export type PasswordResetToken = InferSelectModel<typeof passwordResetToken>;

// 手机号验证码表：用于注册/登录时的短信验证码校验
export const phoneVerificationCode = pgTable(
  "PhoneVerificationCode",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    phone: varchar("phone", { length: 20 }).notNull(),
    code: varchar("code", { length: 6 }).notNull(),
    // 验证码用途：register=注册, login=登录
    purpose: varchar("purpose", { length: 16 }).notNull().default("register"),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    phoneIdx: index("PhoneVerificationCode_phone_idx").on(table.phone),
    purposeIdx: index("PhoneVerificationCode_purpose_idx").on(table.purpose),
  })
);

export type PhoneVerificationCode = InferSelectModel<
  typeof phoneVerificationCode
>;

// 用户知识库关联表：记录用户创建的智谱知识库
// 智谱知识库本身存储在 Zhipu API 侧，此表仅记录本地关联关系（谁创建了哪个知识库）
export const userKnowledge = pgTable(
  "UserKnowledge",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    // 智谱知识库 ID（由 Zhipu API 返回）
    knowledgeId: text("knowledge_id").notNull(),
    // 知识库名称（冗余存储，避免每次都调 API 查询）
    name: text("name").notNull(),
    description: text("description"),
    // 创建者
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    // 同一用户下知识库 ID 唯一
    userKbUnique: uniqueIndex("UserKnowledge_userId_knowledgeId_idx").on(
      table.userId,
      table.knowledgeId
    ),
    userIdIdx: index("UserKnowledge_userId_idx").on(table.userId),
  })
);

export type UserKnowledge = InferSelectModel<typeof userKnowledge>;

// ============================================================
// SaaS 多租户：团队（Team）、成员（TeamMember）、邀请（Invitation）、
// 活动日志（ActivityLog）—— 从 saas-starter 移植，适配 opcbot 的
// uuid 主键 + camelCase 列名约定
// ============================================================

// 团队表：一个团队对应一个租户，承载 Stripe 订阅与配额信息
export const team = pgTable(
  "Team",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    // 创建者
    ownerId: uuid("ownerId")
      .notNull()
      .references(() => user.id, { onDelete: "set null" }),
    // Stripe 客户 / 订阅 / 产品 ID
    stripeCustomerId: text("stripeCustomerId").unique(),
    stripeSubscriptionId: text("stripeSubscriptionId").unique(),
    stripeProductId: text("stripeProductId"),
    // 套餐名称（free / base / plus 等）
    planName: varchar("planName", { length: 50 }).default("free"),
    subscriptionStatus: subscriptionStatusEnum("subscriptionStatus"),
    // 当前周期起止时间（用于配额按月重置）
    subscriptionStart: timestamp("subscriptionStart"),
    subscriptionEnd: timestamp("subscriptionEnd"),
    // 配额字段：套餐额度（null 表示无限制）
    maxMessages: integer("maxMessages"), // 每月消息数上限
    maxMembers: integer("maxMembers"), // 团队成员数上限
    // 本月已用消息数（由 /api/chat 拦截器累加，定时任务月初重置）
    usedMessages: integer("usedMessages").notNull().default(0),
    usageResetAt: timestamp("usageResetAt"), // 上次配额重置时间
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    ownerIdIdx: index("Team_ownerId_idx").on(table.ownerId),
    stripeCustomerIdx: uniqueIndex("Team_stripeCustomerId_idx").on(
      table.stripeCustomerId
    ),
  })
);

export type Team = InferSelectModel<typeof team>;

// 团队成员表：用户与团队的多对多关系，带角色
export const teamMember = pgTable(
  "TeamMember",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    teamId: uuid("teamId")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: teamRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    teamUserUnique: uniqueIndex("TeamMember_teamId_userId_idx").on(
      table.teamId,
      table.userId
    ),
    teamIdIdx: index("TeamMember_teamId_idx").on(table.teamId),
    userIdIdx: index("TeamMember_userId_idx").on(table.userId),
  })
);

export type TeamMember = InferSelectModel<typeof teamMember>;

// 邀请表：团队成员邀请
export const invitation = pgTable(
  "Invitation",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    teamId: uuid("teamId")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: teamRoleEnum("role").notNull().default("member"),
    invitedBy: uuid("invitedBy")
      .notNull()
      .references(() => user.id, { onDelete: "set null" }),
    status: invitationStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    teamEmailIdx: index("Invitation_teamId_email_idx").on(
      table.teamId,
      table.email
    ),
    emailIdx: index("Invitation_email_idx").on(table.email),
  })
);

export type Invitation = InferSelectModel<typeof invitation>;

// 活动日志表：记录团队内关键操作（登录、创建团队、邀请成员等）
export const activityLog = pgTable(
  "ActivityLog",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    teamId: uuid("teamId").references(() => team.id, { onDelete: "cascade" }),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    action: varchar("action", { length: 50 }).notNull(),
    ipAddress: varchar("ipAddress", { length: 45 }),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
  },
  (table) => ({
    teamIdIdx: index("ActivityLog_teamId_idx").on(table.teamId),
    userIdIdx: index("ActivityLog_userId_idx").on(table.userId),
  })
);

export type ActivityLog = InferSelectModel<typeof activityLog>;

// 活动类型枚举（与 saas-starter 对齐）
export enum ActivityType {
  SIGN_UP = "SIGN_UP",
  SIGN_IN = "SIGN_IN",
  SIGN_OUT = "SIGN_OUT",
  UPDATE_PASSWORD = "UPDATE_PASSWORD",
  DELETE_ACCOUNT = "DELETE_ACCOUNT",
  UPDATE_ACCOUNT = "UPDATE_ACCOUNT",
  CREATE_TEAM = "CREATE_TEAM",
  REMOVE_TEAM_MEMBER = "REMOVE_TEAM_MEMBER",
  INVITE_TEAM_MEMBER = "INVITE_TEAM_MEMBER",
  ACCEPT_INVITATION = "ACCEPT_INVITATION",
}

// ============================================================
// 关系定义（用于 drizzle query API 的 with 关联查询）
// ============================================================
export const teamRelations = relations(team, ({ many }) => ({
  teamMembers: many(teamMember),
  invitations: many(invitation),
  activityLogs: many(activityLog),
}));

export const teamMemberRelations = relations(teamMember, ({ one }) => ({
  team: one(team, {
    fields: [teamMember.teamId],
    references: [team.id],
  }),
  user: one(user, {
    fields: [teamMember.userId],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  team: one(team, {
    fields: [invitation.teamId],
    references: [team.id],
  }),
  inviter: one(user, {
    fields: [invitation.invitedBy],
    references: [user.id],
  }),
}));

export const activityLogRelations = relations(activityLog, ({ one }) => ({
  team: one(team, {
    fields: [activityLog.teamId],
    references: [team.id],
  }),
  user: one(user, {
    fields: [activityLog.userId],
    references: [user.id],
  }),
}));

// 团队数据（含成员列表）—— 用于团队设置页
export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, "id" | "name" | "email" | "image">;
  })[];
};

// ============================================================
// OPC 交易市场：企业资质表（2B）
// ============================================================

// 企业表：一个企业对应一个 2B 主体，承载资质认证状态
export const enterprise = pgTable(
  "Enterprise",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    // 企业名称（工商注册全称）
    name: varchar("name", { length: 200 }).notNull(),
    // 统一社会信用代码
    creditCode: varchar("creditCode", { length: 32 }).notNull(),
    // 联系人姓名 / 电话
    contactName: varchar("contactName", { length: 50 }).notNull(),
    contactPhone: varchar("contactPhone", { length: 20 }).notNull(),
    // 营业执照图片 URL
    licenseImage: text("licenseImage"),
    // 认证状态
    verifyStatus: enterpriseVerifyStatusEnum("verifyStatus")
      .notNull()
      .default("unverified"),
    // 认证驳回理由
    verifyRejectReason: text("verifyRejectReason"),
    // 认证审核人（管理员）
    verifiedBy: uuid("verifiedBy").references(() => user.id, {
      onDelete: "set null",
    }),
    verifiedAt: timestamp("verifiedAt"),
    // 创建者（企业管理员账号）
    ownerId: uuid("ownerId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    creditCodeIdx: uniqueIndex("Enterprise_creditCode_idx").on(table.creditCode),
    ownerIdIdx: index("Enterprise_ownerId_idx").on(table.ownerId),
    verifyStatusIdx: index("Enterprise_verifyStatus_idx").on(table.verifyStatus),
  })
);

export type Enterprise = InferSelectModel<typeof enterprise>;

// ============================================================
// OPC 交易市场：上架申请表
// ============================================================

export const opcListingApplication = pgTable(
  "OpcListingApplication",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    // 申请上架的 OPC
    agentId: uuid("agentId")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    // 申请人（个人创作者 user.id 或企业管理员 user.id）
    applicantId: uuid("applicantId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // 申请类型：list=上架 / delist=下架
    type: varchar("type", { enum: ["list", "delist"] }).notNull().default("list"),
    // 申请理由 / OPC 卖点描述
    description: text("description"),
    // 审核状态
    status: listingApplicationStatusEnum("status").notNull().default("pending"),
    // 审核人（管理员）
    reviewerId: uuid("reviewerId").references(() => user.id, {
      onDelete: "set null",
    }),
    // 驳回理由
    rejectReason: text("rejectReason"),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    agentIdIdx: index("OpcListingApplication_agentId_idx").on(table.agentId),
    applicantIdIdx: index("OpcListingApplication_applicantId_idx").on(
      table.applicantId
    ),
    statusIdx: index("OpcListingApplication_status_idx").on(table.status),
  })
);

export type OpcListingApplication = InferSelectModel<
  typeof opcListingApplication
>;

// ============================================================
// OPC 交易市场：订阅订单表（企业订阅公共 OPC）
// ============================================================

export const opcOrder = pgTable(
  "OpcOrder",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    // 订单号（业务可读）
    orderNo: varchar("orderNo", { length: 64 }).notNull(),
    // 订阅企业
    enterpriseId: uuid("enterpriseId")
      .notNull()
      .references(() => enterprise.id, { onDelete: "cascade" }),
    // 下单用户（企业管理员）
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // 被订阅的公共 OPC
    agentId: uuid("agentId")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    // 订阅周期：monthly / yearly
    period: varchar("period", { enum: ["monthly", "yearly"] }).notNull(),
    // 订单金额（分）
    amount: integer("amount").notNull(),
    // 收益分成比例（所有者分得百分比，0-100）
    ownerRevenuePercent: integer("ownerRevenuePercent").notNull().default(70),
    // Stripe 支付意图 / checkout session ID
    stripePaymentIntentId: text("stripePaymentIntentId"),
    stripeCheckoutSessionId: text("stripeCheckoutSessionId"),
    // 支付状态：pending / paid / refunded / failed
    paymentStatus: varchar("paymentStatus", {
      enum: ["pending", "paid", "refunded", "failed"],
    })
      .notNull()
      .default("pending"),
    paidAt: timestamp("paidAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    orderNoIdx: uniqueIndex("OpcOrder_orderNo_idx").on(table.orderNo),
    enterpriseIdIdx: index("OpcOrder_enterpriseId_idx").on(table.enterpriseId),
    agentIdIdx: index("OpcOrder_agentId_idx").on(table.agentId),
    paymentStatusIdx: index("OpcOrder_paymentStatus_idx").on(table.paymentStatus),
  })
);

export type OpcOrder = InferSelectModel<typeof opcOrder>;

// ============================================================
// OPC 交易市场：订阅记录表（订单支付成功后生成）
// ============================================================

export const opcSubscription = pgTable(
  "OpcSubscription",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    // 订阅企业
    enterpriseId: uuid("enterpriseId")
      .notNull()
      .references(() => enterprise.id, { onDelete: "cascade" }),
    // 被订阅的公共 OPC
    agentId: uuid("agentId")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    // 订阅后复制的独立 OPC 副本 ID（企业可编辑副本，不影响原始公共 OPC）
    clonedAgentId: uuid("clonedAgentId").references(() => agent.id, {
      onDelete: "set null",
    }),
    // 关联订单
    orderId: uuid("orderId").references(() => opcOrder.id, {
      onDelete: "set null",
    }),
    // 订阅周期
    period: varchar("period", { enum: ["monthly", "yearly"] }).notNull(),
    // 订阅金额（分）
    amount: integer("amount").notNull(),
    // 收益分成比例
    ownerRevenuePercent: integer("ownerRevenuePercent").notNull().default(70),
    // 订阅状态
    status: opcSubscriptionStatusEnum("status").notNull().default("active"),
    // 生效 / 到期时间
    startDate: timestamp("startDate").notNull(),
    endDate: timestamp("endDate").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    enterpriseAgentIdx: uniqueIndex("OpcSubscription_enterprise_agent_idx").on(
      table.enterpriseId,
      table.agentId
    ),
    enterpriseIdIdx: index("OpcSubscription_enterpriseId_idx").on(
      table.enterpriseId
    ),
    agentIdIdx: index("OpcSubscription_agentId_idx").on(table.agentId),
    statusIdx: index("OpcSubscription_status_idx").on(table.status),
  })
);

export type OpcSubscription = InferSelectModel<typeof opcSubscription>;

// ============================================================
// OPC 交易市场：收益分成记录表
// ============================================================

export const opcRevenue = pgTable(
  "OpcRevenue",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    // 收益归属：OPC 所有者（个人创作者 user.id / 平台用固定标记）
    ownerId: uuid("ownerId").references(() => user.id, {
      onDelete: "set null",
    }),
    ownerType: opcOwnerTypeEnum("ownerType").notNull(),
    // 来源订阅
    subscriptionId: uuid("subscriptionId").references(() => opcSubscription.id, {
      onDelete: "cascade",
    }),
    // 来源订单
    orderId: uuid("orderId").references(() => opcOrder.id, {
      onDelete: "cascade",
    }),
    // 被订阅的 OPC
    agentId: uuid("agentId")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    // 订阅企业
    enterpriseId: uuid("enterpriseId").references(() => enterprise.id, {
      onDelete: "cascade",
    }),
    // 订单总金额（分）
    orderAmount: integer("orderAmount").notNull(),
    // 分成比例
    revenuePercent: integer("revenuePercent").notNull(),
    // 实际收益金额（分）
    revenueAmount: integer("revenueAmount").notNull(),
    // 结算状态：pending / settled
    settleStatus: varchar("settleStatus", {
      enum: ["pending", "settled"],
    })
      .notNull()
      .default("pending"),
    settledAt: timestamp("settledAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    ownerIdIdx: index("OpcRevenue_ownerId_idx").on(table.ownerId),
    agentIdIdx: index("OpcRevenue_agentId_idx").on(table.agentId),
    settleStatusIdx: index("OpcRevenue_settleStatus_idx").on(table.settleStatus),
  })
);

export type OpcRevenue = InferSelectModel<typeof opcRevenue>;


