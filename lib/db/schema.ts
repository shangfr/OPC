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
  numeric,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// ============================================================
// 枚举定义（全部统一为 pgEnum）
// ============================================================
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const teamRoleEnum = pgEnum("team_role", ["owner", "admin", "member"]);
export const invitationStatusEnum = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
]);
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
export const accountTypeEnum = pgEnum("account_type", [
  "personal",
  "enterprise",
  "platform",
]);
export const enterpriseVerifyStatusEnum = pgEnum("enterprise_verify_status", [
  "unverified",
  "pending",
  "verified",
  "rejected",
]);
export const opcOwnerTypeEnum = pgEnum("opc_owner_type", [
  "personal",
  "enterprise",
  "platform",
]);
export const opcListingStatusEnum = pgEnum("opc_listing_status", [
  "private",
  "pending",
  "listed",
  "delisted",
]);
export const listingApplicationStatusEnum = pgEnum("listing_application_status", [
  "pending",
  "approved",
  "rejected",
  "withdrawn",
]);
export const opcSubscriptionStatusEnum = pgEnum("opc_subscription_status", [
  "active",
  "expired",
  "canceled",
]);
export const agentVisibilityEnum = pgEnum("agent_visibility", [
  "public",
  "private",
]);
export const chatTypeEnum = pgEnum("chat_type", ["personal", "team"]);
export const documentKindEnum = pgEnum("document_kind", [
  "text",
  "code",
  "image",
  "html",
  "sheet",
]);
export const ticketPriorityEnum = pgEnum("ticket_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);
export const ticketStatusEnum = pgEnum("ticket_status", [
  "pending",
  "in_progress",
  "completed",
  "closed",
]);
export const ticketVisibilityEnum = pgEnum("ticket_visibility", [
  "public",
  "private",
]);
export const ticketPublishSourceEnum = pgEnum("ticket_publish_source", [
  "ai",
  "manual",
]);
export const ticketReviewStatusEnum = pgEnum("ticket_review_status", [
  "pending",
  "approved",
  "rejected",
]);
export const ticketActivityTypeEnum = pgEnum("ticket_activity_type", [
  "created",
  "updated",
  "status_changed",
  "priority_changed",
  "assignee_changed",
  "commented",
  "deleted",
  "reviewed",
]);
export const activityTypeEnum = pgEnum("activity_type", [
  "SIGN_UP",
  "SIGN_IN",
  "SIGN_OUT",
  "UPDATE_PASSWORD",
  "DELETE_ACCOUNT",
  "UPDATE_ACCOUNT",
  "CREATE_TEAM",
  "REMOVE_TEAM_MEMBER",
  "INVITE_TEAM_MEMBER",
  "ACCEPT_INVITATION",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "paid",
  "refunded",
  "failed",
]);
export const settleStatusEnum = pgEnum("settle_status", [
  "pending",
  "settled",
]);
export const opcApplicationTypeEnum = pgEnum("opc_application_type", [
  "list",
  "delist",
]);
export const subscriptionPeriodEnum = pgEnum("subscription_period", [
  "monthly",
  "yearly",
]);
export const phoneCodePurposeEnum = pgEnum("phone_code_purpose", [
  "register",
  "login",
]);

// ============================================================
// 核心用户与认证模块
// ============================================================
export const user = pgTable(
  "user",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    email: varchar("email", { length: 64 }).notNull(),
    password: varchar("password", { length: 255 }),
    name: text("name"),
    emailVerified: boolean("emailVerified").notNull().default(false),
    image: text("image"),
    isAnonymous: boolean("isAnonymous").notNull().default(false),
    role: userRoleEnum("role").notNull().default("user"),
    phone: varchar("phone", { length: 20 }),
    accountType: accountTypeEnum("accountType").notNull().default("personal"),
    // 套餐驱动型权限：用户级套餐决定功能权限（free/creator/team/enterprise）
    planName: varchar("planName", { length: 50 }).default("free"),
    enterpriseId: uuid("enterpriseId").references((): AnyPgColumn => enterprise.id, {
      onDelete: "set null",
    }),
    bannedAt: timestamp("bannedAt"),
    bannedReason: text("bannedReason"),
    isDeleted: boolean("isDeleted").notNull().default(false),
    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("user_email_idx").on(sql`lower(${table.email})`),
    phoneIdx: uniqueIndex("user_phone_idx").on(table.phone).where(
      sql`${table.phone} IS NOT NULL`
    ),
    accountTypeIdx: index("user_account_type_idx").on(table.accountType),
    enterpriseIdIdx: index("user_enterprise_id_idx").on(table.enterpriseId),
    // 新增：为软删除查询优化
    isDeletedIdx: index("user_is_deleted_idx")
      .on(table.isDeleted)
      .where(sql`${table.isDeleted} = false`),
  })
);
export type User = InferSelectModel<typeof user>;

export const passwordResetToken = pgTable("password_reset_token", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  email: varchar("email", { length: 64 }).notNull(),
  token: text("token").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});

export const phoneVerificationCode = pgTable(
  "phone_verification_code",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    phone: varchar("phone", { length: 20 }).notNull(),
    code: varchar("code", { length: 6 }).notNull(),
    purpose: phoneCodePurposeEnum("purpose").notNull().default("register"),
    expiresAt: timestamp("expiresAt").notNull(),
    usedAt: timestamp("usedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    phoneIdx: index("phone_verification_code_phone_idx").on(table.phone),
    purposeIdx: index("phone_verification_code_purpose_idx").on(table.purpose),
  })
);

export const userKnowledge = pgTable(
  "user_knowledge",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    knowledgeId: text("knowledgeId").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    userKbUnique: uniqueIndex("user_knowledge_user_id_kb_id_idx").on(
      table.userId,
      table.knowledgeId
    ),
    userIdIdx: index("user_knowledge_user_id_idx").on(table.userId),
  })
);

// ============================================================
// SaaS 多租户模块
// ============================================================
export const team = pgTable(
  "team",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull(),
    ownerId: uuid("ownerId")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    stripeCustomerId: text("stripeCustomerId").unique(),
    stripeSubscriptionId: text("stripeSubscriptionId").unique(),
    stripeProductId: text("stripeProductId"),
    planName: varchar("planName", { length: 50 }).default("free"),
    subscriptionStatus: subscriptionStatusEnum("subscriptionStatus"),
    subscriptionStart: timestamp("subscriptionStart"),
    subscriptionEnd: timestamp("subscriptionEnd"),
    maxMessages: integer("maxMessages"),
    maxMembers: integer("maxMembers"),
    usedMessages: integer("usedMessages").notNull().default(0),
    usageResetAt: timestamp("usageResetAt"),
    version: integer("version").notNull().default(0),
    isDeleted: boolean("isDeleted").notNull().default(false),
    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    ownerIdIdx: index("team_owner_id_idx").on(table.ownerId),
    stripeCustomerIdx: uniqueIndex("team_stripe_customer_id_idx").on(
      table.stripeCustomerId
    ),
    // 新增：为软删除查询优化
    isDeletedIdx: index("team_is_deleted_idx")
      .on(table.isDeleted)
      .where(sql`${table.isDeleted} = false`),
  })
);
export type Team = InferSelectModel<typeof team>;

export const teamMember = pgTable(
  "team_member",
  {
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
    pk: primaryKey({ columns: [table.teamId, table.userId] }),
  })
);
export type TeamMember = InferSelectModel<typeof teamMember>;

export const invitation = pgTable(
  "invitation",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    teamId: uuid("teamId")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 255 }).notNull(),
    role: teamRoleEnum("role").notNull().default("member"),
    invitedBy: uuid("invitedBy")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    status: invitationStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    teamEmailIdx: index("invitation_team_id_email_idx").on(
      table.teamId,
      table.email
    ),
    emailIdx: index("invitation_email_idx").on(table.email),
  })
);

export const activityLog = pgTable(
  "activity_log",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    teamId: uuid("teamId").references(() => team.id, { onDelete: "cascade" }),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    action: activityTypeEnum("action").notNull(),
    ipAddress: varchar("ipAddress", { length: 45 }),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
  },
  (table) => ({
    teamIdIdx: index("activity_log_team_id_idx").on(table.teamId),
    userIdIdx: index("activity_log_user_id_idx").on(table.userId),
  })
);

export const usageEvent = pgTable(
  "usage_event",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    teamId: uuid("teamId")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chatId: uuid("chatId").references(() => chat.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    teamIdIdx: index("usage_event_team_id_idx").on(table.teamId),
    createdAtIdx: index("usage_event_created_at_idx").on(table.createdAt),
  })
);

// ============================================================
// 聊天与文档模块
// ============================================================
export const chat = pgTable(
  "chat",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    title: text("title").notNull(),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chatType: chatTypeEnum("chatType").notNull().default("personal"),
    visibility: agentVisibilityEnum("visibility").notNull().default("private"),
    agentId: uuid("agentId").references(() => agent.id, { onDelete: "set null" }),
    agentName: text("agentName"),
    pinnedAt: timestamp("pinnedAt"),
    teamId: uuid("teamId").references(() => team.id, { onDelete: "cascade" }),
    isDeleted: boolean("isDeleted").notNull().default(false),
    deletedAt: timestamp("deletedAt"),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("chat_user_id_idx").on(table.userId),
    createdAtIdx: index("chat_created_at_idx").on(table.createdAt),
    pinnedAtIdx: index("chat_pinned_at_idx").on(table.pinnedAt),
    teamIdIdx: index("chat_team_id_idx").on(table.teamId),
  })
);
export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable(
  "message_v2",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, { onDelete: "cascade" }),
    role: varchar("role").notNull(),
    parts: json("parts").$type<
      { type: string; text?: string; image?: { url: string } }[]
    >().notNull(),
    attachments: json("attachments").$type<
      { id: string; name: string; url: string }[]
    >().notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    chatCreatedIdx: index("message_chat_id_created_at_idx").on(
      table.chatId,
      table.createdAt
    ),
  })
);
export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
  "vote_v2",
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

export const document = pgTable("document", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  title: text("title").notNull(),
  content: text("content"),
  kind: documentKindEnum("kind").notNull().default("text"),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});
export type Document = InferSelectModel<typeof document>;

export const documentVersion = pgTable(
  "document_version",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    documentId: uuid("documentId")
      .notNull()
      .references(() => document.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    content: text("content"),
    kind: documentKindEnum("kind").notNull(),
    version: integer("version").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    docVersionIdx: index("document_version_doc_id_version_idx").on(
      table.documentId,
      table.version
    ),
  })
);

export const suggestion = pgTable("suggestion", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  documentId: uuid("documentId")
    .notNull()
    .references(() => document.id, { onDelete: "cascade" }),
  originalText: text("originalText").notNull(),
  suggestedText: text("suggestedText").notNull(),
  description: text("description"),
  isResolved: boolean("isResolved").notNull().default(false),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable("stream", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export type Stream = InferSelectModel<typeof stream>;

// ============================================================
// Agent 与分类模块
// ============================================================
export const category = pgTable("category", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  sortOrder: integer("sortOrder").notNull().default(0),
  colorKey: text("colorKey").notNull().default("indigo"),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export type Category = InferSelectModel<typeof category>;

export const agent = pgTable(
  "agent",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    avatar: text("avatar").notNull().default("/icon.png"),
    systemPrompt: text("systemPrompt").notNull(),
    phone: varchar("phone", { length: 20 }),
    knowledgeId: text("knowledgeId"),
    starterQuestions: json("starterQuestions").$type<string[]>().default([]),
    isActive: boolean("isActive").notNull().default(true),
    isDefault: boolean("isDefault").notNull().default(false),
    sortOrder: integer("sortOrder").notNull().default(0),
    categoryId: uuid("categoryId").references(() => category.id, {
      onDelete: "set null",
    }),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ownerType: opcOwnerTypeEnum("ownerType").notNull().default("personal"),
    ownerId: uuid("ownerId"),
    visibility: agentVisibilityEnum("visibility").notNull().default("public"),
    listingStatus: opcListingStatusEnum("listingStatus").notNull().default(
      "private"
    ),
    priceMonthly: integer("priceMonthly").notNull().default(0),
    priceYearly: integer("priceYearly").notNull().default(0),
    listedAt: timestamp("listedAt"),
    delistedAt: timestamp("delistedAt"),
    delistedBy: uuid("delistedBy").references(() => user.id, {
      onDelete: "set null",
    }),
    delistReason: text("delistReason"),
    sourceAgentId: uuid("sourceAgentId").references((): AnyPgColumn => agent.id, {
      onDelete: "set null",
    }),
    version: integer("version").notNull().default(0),
    isDeleted: boolean("isDeleted").notNull().default(false),
    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    defaultUnique: uniqueIndex("agent_default_idx")
      .on(table.isDefault)
      .where(sql`${table.isDefault} = true`),
    userIdIdx: index("agent_user_id_idx").on(table.userId),
    visibilityIdx: index("agent_visibility_idx").on(table.visibility),
    listingStatusIdx: index("agent_listing_status_idx").on(table.listingStatus),
    ownerTypeIdx: index("agent_owner_type_owner_id_idx").on(
      table.ownerType,
      table.ownerId
    ),
    // 新增：优化列表查询
    listViewIdx: index("agent_list_view_idx")
      .on(table.visibility, table.createdAt)
      .where(sql`${table.isDeleted} = false`),
    // 新增：为软删除查询优化
    isDeletedIdx: index("agent_is_deleted_idx")
      .on(table.isDeleted)
      .where(sql`${table.isDeleted} = false`),
  })
);
export type Agent = InferSelectModel<typeof agent>;

// ============================================================
// 工单系统
// ============================================================
export const ticketCategory = pgTable("ticket_category", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  sortOrder: integer("sortOrder").notNull().default(0),
  colorKey: text("colorKey").notNull().default("indigo"),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export type TicketCategory = InferSelectModel<typeof ticketCategory>;

export const ticket = pgTable(
  "ticket",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    content: text("content"),
    priority: ticketPriorityEnum("priority").notNull().default("medium"),
    status: ticketStatusEnum("status").notNull().default("pending"),
    progress: integer("progress").notNull().default(0),
    assignee: text("assignee"),
    phone: varchar("phone", { length: 20 }),
    dueDate: timestamp("dueDate"),
    categoryId: uuid("categoryId").references(() => ticketCategory.id, {
      onDelete: "set null",
    }),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    visibility: ticketVisibilityEnum("visibility").notNull().default("public"),
    isActive: boolean("isActive").notNull().default(true),
    sortOrder: integer("sortOrder").notNull().default(0),
    publishSource: ticketPublishSourceEnum("publishSource").notNull().default(
      "manual"
    ),
    reviewStatus: ticketReviewStatusEnum("reviewStatus").notNull().default(
      "approved"
    ),
    reviewedById: uuid("reviewedById").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewedAt"),
    reviewNote: text("reviewNote"),
    viewCount: integer("viewCount").notNull().default(0),
    expiryDate: timestamp("expiryDate"),
    contactName: text("contactName"),
    province: text("province"),
    city: text("city"),
    formData: jsonb("formData").$type<Record<string, any>>(),
    aiRawText: text("aiRawText"),
    isDeleted: boolean("isDeleted").notNull().default(false),
    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("ticket_user_id_idx").on(table.userId),
    statusPriorityIdx: index("ticket_status_priority_idx").on(
      table.status,
      table.priority
    ),
    assigneeStatusIdx: index("ticket_assignee_status_idx").on(
      table.assignee,
      table.status
    ),
    visibilityIdx: index("ticket_visibility_idx").on(table.visibility),
    dueDateIdx: index("ticket_due_date_idx").on(table.dueDate),
    publishSourceIdx: index("ticket_publish_source_idx").on(table.publishSource),
    reviewStatusIdx: index("ticket_review_status_idx").on(table.reviewStatus),
    expiryDateIdx: index("ticket_expiry_date_idx").on(table.expiryDate),
    // 新增：JSONB GIN 索引
    formDataIdx: index("ticket_form_data_idx").using("gin", table.formData),
    // 新增：为软删除查询优化
    isDeletedIdx: index("ticket_is_deleted_idx")
      .on(table.isDeleted)
      .where(sql`${table.isDeleted} = false`),
  })
);
export type Ticket = InferSelectModel<typeof ticket>;

export const ticketComment = pgTable("ticket_comment", {
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

export const ticketActivity = pgTable("ticket_activity", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  ticketId: uuid("ticketId")
    .notNull()
    .references(() => ticket.id, { onDelete: "cascade" }),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  type: ticketActivityTypeEnum("type").notNull(),
  summary: text("summary").notNull(),
  oldValue: text("oldValue"),
  newValue: text("newValue"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export type TicketActivity = InferSelectModel<typeof ticketActivity>;

export const ticketTag = pgTable("ticket_tag", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: text("name").notNull(),
  color: text("color").notNull().default("#6366f1"),
  userId: uuid("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
export type TicketTag = InferSelectModel<typeof ticketTag>;

export const ticketTagRelation = pgTable(
  "ticket_tag_relation",
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
  })
);
export type TicketTagRelation = InferSelectModel<typeof ticketTagRelation>;

// ============================================================
// OPC 交易市场
// ============================================================
export const enterprise = pgTable(
  "enterprise",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    creditCode: varchar("creditCode", { length: 32 }).notNull(),
    contactName: varchar("contactName", { length: 50 }).notNull(),
    contactPhone: varchar("contactPhone", { length: 20 }).notNull(),
    licenseImage: text("licenseImage"),
    verifyStatus: enterpriseVerifyStatusEnum("verifyStatus").notNull().default(
      "unverified"
    ),
    verifyRejectReason: text("verifyRejectReason"),
    verifiedBy: uuid("verifiedBy").references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
    verifiedAt: timestamp("verifiedAt"),
    ownerId: uuid("ownerId")
      .notNull()
      .references((): AnyPgColumn => user.id, { onDelete: "restrict" }),
    industry: varchar("industry", { length: 100 }),
    address: varchar("address", { length: 255 }),
    legalRepresentative: varchar("legalRepresentative", { length: 50 }),
    registeredCapital: varchar("registeredCapital", { length: 50 }),
    isDeleted: boolean("isDeleted").notNull().default(false),
    deletedAt: timestamp("deletedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    creditCodeIdx: uniqueIndex("enterprise_credit_code_idx").on(
      table.creditCode
    ),
    ownerIdIdx: index("enterprise_owner_id_idx").on(table.ownerId),
    verifyStatusIdx: index("enterprise_verify_status_idx").on(table.verifyStatus),
  })
);
export type Enterprise = InferSelectModel<typeof enterprise>;

export const opcListingApplication = pgTable(
  "opc_listing_application",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    agentId: uuid("agentId")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    applicantId: uuid("applicantId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: opcApplicationTypeEnum("type").notNull().default("list"),
    description: text("description"),
    status: listingApplicationStatusEnum("status").notNull().default("pending"),
    reviewerId: uuid("reviewerId").references(() => user.id, {
      onDelete: "set null",
    }),
    rejectReason: text("rejectReason"),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    agentIdIdx: index("opc_listing_application_agent_id_idx").on(table.agentId),
    applicantIdIdx: index("opc_listing_application_applicant_id_idx").on(
      table.applicantId
    ),
    statusIdx: index("opc_listing_application_status_idx").on(table.status),
  })
);

export const revenuePolicy = pgTable("revenue_policy", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  name: varchar("name", { length: 100 }).notNull(),
  ownerRevenuePercent: integer("ownerRevenuePercent").notNull().default(70),
  isActive: boolean("isActive").notNull().default(true),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const opcOrder = pgTable(
  "opc_order",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    orderNo: varchar("orderNo", { length: 64 }).notNull(),
    enterpriseId: uuid("enterpriseId")
      .notNull()
      .references(() => enterprise.id, { onDelete: "restrict" }),
    userId: uuid("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    agentId: uuid("agentId")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    period: subscriptionPeriodEnum("period").notNull(),
    // 优化：使用 NUMERIC 类型存储金额
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    ownerRevenuePercent: integer("ownerRevenuePercent").notNull().default(70),
    policyId: uuid("policyId").references(() => revenuePolicy.id, {
      onDelete: "set null",
    }),
    stripePaymentIntentId: text("stripePaymentIntentId"),
    stripeCheckoutSessionId: text("stripeCheckoutSessionId"),
    paymentStatus: paymentStatusEnum("paymentStatus").notNull().default(
      "pending"
    ),
    paidAt: timestamp("paidAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    orderNoIdx: uniqueIndex("opc_order_order_no_idx").on(table.orderNo),
    enterpriseIdIdx: index("opc_order_enterprise_id_idx").on(table.enterpriseId),
    agentIdIdx: index("opc_order_agent_id_idx").on(table.agentId),
    paymentStatusIdx: index("opc_order_payment_status_idx").on(
      table.paymentStatus
    ),
  })
);
export type OpcOrder = InferSelectModel<typeof opcOrder>;

export const opcSubscription = pgTable(
  "opc_subscription",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    enterpriseId: uuid("enterpriseId")
      .notNull()
      .references(() => enterprise.id, { onDelete: "cascade" }),
    agentId: uuid("agentId")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    clonedAgentId: uuid("clonedAgentId").references(() => agent.id, {
      onDelete: "set null",
    }),
    orderId: uuid("orderId").references(() => opcOrder.id, {
      onDelete: "set null",
    }),
    period: subscriptionPeriodEnum("period").notNull(),
    // 优化：使用 NUMERIC 类型存储金额
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    ownerRevenuePercent: integer("ownerRevenuePercent").notNull().default(70),
    status: opcSubscriptionStatusEnum("status").notNull().default("active"),
    startDate: timestamp("startDate").notNull(),
    endDate: timestamp("endDate").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  },
  (table) => ({
    enterpriseAgentActiveIdx: uniqueIndex(
      "opc_subscription_enterprise_agent_active_idx"
    )
      .on(table.enterpriseId, table.agentId)
      .where(sql`status = 'active'`),
    enterpriseIdIdx: index("opc_subscription_enterprise_id_idx").on(
      table.enterpriseId
    ),
    agentIdIdx: index("opc_subscription_agent_id_idx").on(table.agentId),
    statusEndDateIdx: index("opc_subscription_status_end_date_idx").on(
      table.status,
      table.endDate
    ),
  })
);
export type OpcSubscription = InferSelectModel<typeof opcSubscription>;

export const opcRevenue = pgTable(
  "opc_revenue",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    ownerId: uuid("ownerId").references((): AnyPgColumn => user.id, { onDelete: "restrict" }),
    ownerType: opcOwnerTypeEnum("ownerType").notNull(),
    subscriptionId: uuid("subscriptionId").references(() => opcSubscription.id, {
      onDelete: "cascade",
    }),
    orderId: uuid("orderId").references(() => opcOrder.id, {
      onDelete: "cascade",
    }),
    agentId: uuid("agentId")
      .notNull()
      .references(() => agent.id, { onDelete: "cascade" }),
    enterpriseId: uuid("enterpriseId")
      .notNull()
      .references(() => enterprise.id, { onDelete: "cascade" }),
    orderAmount: integer("orderAmount").notNull(),
    revenuePercent: integer("revenuePercent").notNull(),
    revenueAmount: integer("revenueAmount").notNull(),
    settleStatus: settleStatusEnum("settleStatus").notNull().default("pending"),
    settledAt: timestamp("settledAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    ownerIdIdx: index("opc_revenue_owner_id_idx").on(table.ownerId),
    agentIdIdx: index("opc_revenue_agent_id_idx").on(table.agentId),
    settleStatusIdx: index("opc_revenue_settle_status_idx").on(
      table.settleStatus
    ),
  })
);
export type OpcRevenue = InferSelectModel<typeof opcRevenue>;

export const siteConfig = pgTable("site_config", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  defaultSystemPrompt: text("defaultSystemPrompt"),
  defaultStarterQuestions: json("defaultStarterQuestions").$type<string[]>(),
  siteName: text("siteName"),
  siteDescription: text("siteDescription"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

// ============================================================
// 关系定义
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

export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, "id" | "name" | "email" | "image">;
  })[];
};
