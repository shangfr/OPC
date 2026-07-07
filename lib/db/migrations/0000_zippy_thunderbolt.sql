DO $$ BEGIN
 CREATE TYPE "public"."account_type" AS ENUM('personal', 'enterprise');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."agent_visibility" AS ENUM('public', 'private');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."enterprise_verify_status" AS ENUM('unverified', 'pending', 'verified', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'revoked');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."listing_application_status" AS ENUM('pending', 'approved', 'rejected', 'withdrawn');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."opc_listing_status" AS ENUM('private', 'pending', 'listed', 'delisted');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."opc_owner_type" AS ENUM('user', 'enterprise', 'platform');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."opc_ownership_type" AS ENUM('personal_private', 'enterprise_private', 'public');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."opc_subscription_status" AS ENUM('active', 'expired', 'canceled');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."subscription_status" AS ENUM('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete', 'incomplete_expired', 'paused');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."team_role" AS ENUM('owner', 'admin', 'member');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ticket_activity_type" AS ENUM('created', 'updated', 'status_changed', 'priority_changed', 'assignee_changed', 'commented', 'deleted', 'reviewed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ticket_priority" AS ENUM('low', 'medium', 'high', 'urgent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ticket_publish_source" AS ENUM('ai', 'manual');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ticket_review_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ticket_status" AS ENUM('pending', 'in_progress', 'completed', 'closed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."ticket_visibility" AS ENUM('public', 'private');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('user', 'moderator', 'admin');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ActivityLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamId" uuid,
	"userId" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"ipAddress" varchar(45),
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Agent" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"avatar" text DEFAULT '/icon.png' NOT NULL,
	"system_prompt" text NOT NULL,
	"phone" text,
	"knowledge_id" text,
	"starter_questions" json DEFAULT '[]'::json,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"categoryId" uuid,
	"userId" uuid NOT NULL,
	"visibility" "agent_visibility" DEFAULT 'public' NOT NULL,
	"teamId" uuid,
	"ownershipType" "opc_ownership_type" DEFAULT 'personal_private' NOT NULL,
	"ownerType" "opc_owner_type" DEFAULT 'user' NOT NULL,
	"ownerEnterpriseId" uuid,
	"listingStatus" "opc_listing_status" DEFAULT 'private' NOT NULL,
	"priceMonthly" integer DEFAULT 0 NOT NULL,
	"priceYearly" integer DEFAULT 0 NOT NULL,
	"listedAt" timestamp,
	"delistedAt" timestamp,
	"delistedBy" uuid,
	"sourceAgentId" uuid,
	"delistReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"color_key" text DEFAULT 'indigo' NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp NOT NULL,
	"title" text NOT NULL,
	"userId" uuid NOT NULL,
	"visibility" varchar DEFAULT 'private' NOT NULL,
	"agentId" uuid,
	"agentName" text,
	"pinnedAt" timestamp,
	"teamId" uuid
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Document" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"text" varchar DEFAULT 'text' NOT NULL,
	"userId" uuid NOT NULL,
	"chatId" uuid NOT NULL,
	CONSTRAINT "Document_id_createdAt_pk" PRIMARY KEY("id","createdAt")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Enterprise" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"creditCode" varchar(32) NOT NULL,
	"contactName" varchar(50) NOT NULL,
	"contactPhone" varchar(20) NOT NULL,
	"licenseImage" text,
	"verifyStatus" "enterprise_verify_status" DEFAULT 'unverified' NOT NULL,
	"verifyRejectReason" text,
	"verifiedBy" uuid,
	"verifiedAt" timestamp,
	"ownerId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamId" uuid NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" "team_role" DEFAULT 'member' NOT NULL,
	"invitedBy" uuid NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Message_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"role" varchar NOT NULL,
	"parts" json NOT NULL,
	"attachments" json NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "OpcListingApplication" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agentId" uuid NOT NULL,
	"applicantId" uuid NOT NULL,
	"type" varchar DEFAULT 'list' NOT NULL,
	"description" text,
	"status" "listing_application_status" DEFAULT 'pending' NOT NULL,
	"reviewerId" uuid,
	"rejectReason" text,
	"reviewedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "OpcOrder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"orderNo" varchar(64) NOT NULL,
	"enterpriseId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"agentId" uuid NOT NULL,
	"period" varchar NOT NULL,
	"amount" integer NOT NULL,
	"ownerRevenuePercent" integer DEFAULT 70 NOT NULL,
	"stripePaymentIntentId" text,
	"stripeCheckoutSessionId" text,
	"paymentStatus" varchar DEFAULT 'pending' NOT NULL,
	"paidAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "OpcRevenue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ownerId" uuid,
	"ownerType" "opc_owner_type" NOT NULL,
	"subscriptionId" uuid,
	"orderId" uuid,
	"agentId" uuid NOT NULL,
	"enterpriseId" uuid,
	"orderAmount" integer NOT NULL,
	"revenuePercent" integer NOT NULL,
	"revenueAmount" integer NOT NULL,
	"settleStatus" varchar DEFAULT 'pending' NOT NULL,
	"settledAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "OpcSubscription" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"enterpriseId" uuid NOT NULL,
	"agentId" uuid NOT NULL,
	"clonedAgentId" uuid,
	"orderId" uuid,
	"period" varchar NOT NULL,
	"amount" integer NOT NULL,
	"ownerRevenuePercent" integer DEFAULT 70 NOT NULL,
	"status" "opc_subscription_status" DEFAULT 'active' NOT NULL,
	"startDate" timestamp NOT NULL,
	"endDate" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(64) NOT NULL,
	"token" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "PhoneVerificationCode" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" varchar(20) NOT NULL,
	"code" varchar(6) NOT NULL,
	"purpose" varchar(16) DEFAULT 'register' NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"usedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "SiteConfig" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"default_system_prompt" text,
	"default_starter_questions" json,
	"site_name" text,
	"site_description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Stream" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL,
	CONSTRAINT "Stream_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Suggestion" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"documentCreatedAt" timestamp NOT NULL,
	"originalText" text NOT NULL,
	"suggestedText" text NOT NULL,
	"description" text,
	"isResolved" boolean DEFAULT false NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL,
	CONSTRAINT "Suggestion_id_pk" PRIMARY KEY("id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Team" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"ownerId" uuid NOT NULL,
	"stripeCustomerId" text,
	"stripeSubscriptionId" text,
	"stripeProductId" text,
	"planName" varchar(50) DEFAULT 'free',
	"subscriptionStatus" "subscription_status",
	"subscriptionStart" timestamp,
	"subscriptionEnd" timestamp,
	"maxMessages" integer,
	"maxMembers" integer,
	"usedMessages" integer DEFAULT 0 NOT NULL,
	"usageResetAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "Team_stripeCustomerId_unique" UNIQUE("stripeCustomerId"),
	CONSTRAINT "Team_stripeSubscriptionId_unique" UNIQUE("stripeSubscriptionId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TeamMember" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"role" "team_role" DEFAULT 'member' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Ticket" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"content" text,
	"priority" "ticket_priority" DEFAULT 'medium' NOT NULL,
	"status" "ticket_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"assignee" text,
	"phone" text,
	"due_date" timestamp,
	"categoryId" uuid,
	"userId" uuid NOT NULL,
	"visibility" "ticket_visibility" DEFAULT 'public' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"publish_source" "ticket_publish_source" DEFAULT 'manual' NOT NULL,
	"review_status" "ticket_review_status" DEFAULT 'approved' NOT NULL,
	"reviewed_by_id" uuid,
	"reviewed_at" timestamp,
	"review_note" text,
	"view_count" integer DEFAULT 0 NOT NULL,
	"expiry_date" timestamp,
	"contact_name" text,
	"province" text,
	"city" text,
	"form_data" jsonb,
	"ai_raw_text" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TicketActivity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticketId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"type" "ticket_activity_type" NOT NULL,
	"summary" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TicketCategory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"color_key" text DEFAULT 'indigo' NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TicketComment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ticketId" uuid NOT NULL,
	"userId" uuid NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TicketTag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TicketTagRelation" (
	"ticketId" uuid NOT NULL,
	"tagId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "TicketTagRelation_ticketId_tagId_pk" PRIMARY KEY("ticketId","tagId")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(64) NOT NULL,
	"password" varchar(64),
	"name" text,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"isAnonymous" boolean DEFAULT false NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"phone" varchar(20),
	"accountType" "account_type" DEFAULT 'personal' NOT NULL,
	"enterpriseId" uuid,
	"bannedAt" timestamp,
	"bannedReason" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "UserKnowledge" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"userId" uuid NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Vote_v2" (
	"chatId" uuid NOT NULL,
	"messageId" uuid NOT NULL,
	"isUpvoted" boolean NOT NULL,
	CONSTRAINT "Vote_v2_chatId_messageId_pk" PRIMARY KEY("chatId","messageId")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Agent" ADD CONSTRAINT "Agent_categoryId_Category_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Agent" ADD CONSTRAINT "Agent_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Agent" ADD CONSTRAINT "Agent_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Agent" ADD CONSTRAINT "Agent_ownerEnterpriseId_Enterprise_id_fk" FOREIGN KEY ("ownerEnterpriseId") REFERENCES "public"."Enterprise"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Agent" ADD CONSTRAINT "Agent_delistedBy_User_id_fk" FOREIGN KEY ("delistedBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Agent" ADD CONSTRAINT "Agent_sourceAgentId_Agent_id_fk" FOREIGN KEY ("sourceAgentId") REFERENCES "public"."Agent"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Category" ADD CONSTRAINT "Category_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Chat" ADD CONSTRAINT "Chat_agentId_Agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Chat" ADD CONSTRAINT "Chat_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Document" ADD CONSTRAINT "Document_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Enterprise" ADD CONSTRAINT "Enterprise_verifiedBy_User_id_fk" FOREIGN KEY ("verifiedBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Enterprise" ADD CONSTRAINT "Enterprise_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedBy_User_id_fk" FOREIGN KEY ("invitedBy") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpcListingApplication" ADD CONSTRAINT "OpcListingApplication_agentId_Agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpcListingApplication" ADD CONSTRAINT "OpcListingApplication_applicantId_User_id_fk" FOREIGN KEY ("applicantId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpcListingApplication" ADD CONSTRAINT "OpcListingApplication_reviewerId_User_id_fk" FOREIGN KEY ("reviewerId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpcOrder" ADD CONSTRAINT "OpcOrder_enterpriseId_Enterprise_id_fk" FOREIGN KEY ("enterpriseId") REFERENCES "public"."Enterprise"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpcOrder" ADD CONSTRAINT "OpcOrder_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpcOrder" ADD CONSTRAINT "OpcOrder_agentId_Agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpcRevenue" ADD CONSTRAINT "OpcRevenue_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpcRevenue" ADD CONSTRAINT "OpcRevenue_subscriptionId_OpcSubscription_id_fk" FOREIGN KEY ("subscriptionId") REFERENCES "public"."OpcSubscription"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpcRevenue" ADD CONSTRAINT "OpcRevenue_orderId_OpcOrder_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."OpcOrder"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpcRevenue" ADD CONSTRAINT "OpcRevenue_agentId_Agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpcRevenue" ADD CONSTRAINT "OpcRevenue_enterpriseId_Enterprise_id_fk" FOREIGN KEY ("enterpriseId") REFERENCES "public"."Enterprise"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpcSubscription" ADD CONSTRAINT "OpcSubscription_enterpriseId_Enterprise_id_fk" FOREIGN KEY ("enterpriseId") REFERENCES "public"."Enterprise"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpcSubscription" ADD CONSTRAINT "OpcSubscription_agentId_Agent_id_fk" FOREIGN KEY ("agentId") REFERENCES "public"."Agent"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpcSubscription" ADD CONSTRAINT "OpcSubscription_clonedAgentId_Agent_id_fk" FOREIGN KEY ("clonedAgentId") REFERENCES "public"."Agent"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "OpcSubscription" ADD CONSTRAINT "OpcSubscription_orderId_OpcOrder_id_fk" FOREIGN KEY ("orderId") REFERENCES "public"."OpcOrder"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Stream" ADD CONSTRAINT "Stream_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_documentId_documentCreatedAt_Document_id_createdAt_fk" FOREIGN KEY ("documentId","documentCreatedAt") REFERENCES "public"."Document"("id","createdAt") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_User_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_teamId_Team_id_fk" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_categoryId_TicketCategory_id_fk" FOREIGN KEY ("categoryId") REFERENCES "public"."TicketCategory"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_reviewed_by_id_User_id_fk" FOREIGN KEY ("reviewed_by_id") REFERENCES "public"."User"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TicketActivity" ADD CONSTRAINT "TicketActivity_ticketId_Ticket_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TicketActivity" ADD CONSTRAINT "TicketActivity_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TicketCategory" ADD CONSTRAINT "TicketCategory_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_ticketId_Ticket_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TicketComment" ADD CONSTRAINT "TicketComment_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TicketTag" ADD CONSTRAINT "TicketTag_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TicketTagRelation" ADD CONSTRAINT "TicketTagRelation_ticketId_Ticket_id_fk" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "TicketTagRelation" ADD CONSTRAINT "TicketTagRelation_tagId_TicketTag_id_fk" FOREIGN KEY ("tagId") REFERENCES "public"."TicketTag"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "User" ADD CONSTRAINT "User_enterpriseId_Enterprise_id_fk" FOREIGN KEY ("enterpriseId") REFERENCES "public"."Enterprise"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "UserKnowledge" ADD CONSTRAINT "UserKnowledge_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_messageId_Message_v2_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message_v2"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ActivityLog_teamId_idx" ON "ActivityLog" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ActivityLog_userId_idx" ON "ActivityLog" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_default_idx" ON "Agent" USING btree ("is_default") WHERE "Agent"."is_default" = true;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_userId_idx" ON "Agent" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_visibility_idx" ON "Agent" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_teamId_idx" ON "Agent" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_ownershipType_idx" ON "Agent" USING btree ("ownershipType");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_listingStatus_idx" ON "Agent" USING btree ("listingStatus");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_ownerEnterpriseId_idx" ON "Agent" USING btree ("ownerEnterpriseId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Chat_userId_idx" ON "Chat" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Chat_createdAt_idx" ON "Chat" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Chat_pinnedAt_idx" ON "Chat" USING btree ("pinnedAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Chat_teamId_idx" ON "Chat" USING btree ("teamId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Enterprise_creditCode_idx" ON "Enterprise" USING btree ("creditCode");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Enterprise_ownerId_idx" ON "Enterprise" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Enterprise_verifyStatus_idx" ON "Enterprise" USING btree ("verifyStatus");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Invitation_teamId_email_idx" ON "Invitation" USING btree ("teamId","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Invitation_email_idx" ON "Invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Message_chatId_idx" ON "Message_v2" USING btree ("chatId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Message_createdAt_idx" ON "Message_v2" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "OpcListingApplication_agentId_idx" ON "OpcListingApplication" USING btree ("agentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "OpcListingApplication_applicantId_idx" ON "OpcListingApplication" USING btree ("applicantId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "OpcListingApplication_status_idx" ON "OpcListingApplication" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "OpcOrder_orderNo_idx" ON "OpcOrder" USING btree ("orderNo");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "OpcOrder_enterpriseId_idx" ON "OpcOrder" USING btree ("enterpriseId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "OpcOrder_agentId_idx" ON "OpcOrder" USING btree ("agentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "OpcOrder_paymentStatus_idx" ON "OpcOrder" USING btree ("paymentStatus");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "OpcRevenue_ownerId_idx" ON "OpcRevenue" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "OpcRevenue_agentId_idx" ON "OpcRevenue" USING btree ("agentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "OpcRevenue_settleStatus_idx" ON "OpcRevenue" USING btree ("settleStatus");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "OpcSubscription_enterprise_agent_idx" ON "OpcSubscription" USING btree ("enterpriseId","agentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "OpcSubscription_enterpriseId_idx" ON "OpcSubscription" USING btree ("enterpriseId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "OpcSubscription_agentId_idx" ON "OpcSubscription" USING btree ("agentId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "OpcSubscription_status_idx" ON "OpcSubscription" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PhoneVerificationCode_phone_idx" ON "PhoneVerificationCode" USING btree ("phone");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "PhoneVerificationCode_purpose_idx" ON "PhoneVerificationCode" USING btree ("purpose");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Team_ownerId_idx" ON "Team" USING btree ("ownerId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "Team_stripeCustomerId_idx" ON "Team" USING btree ("stripeCustomerId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "TeamMember_teamId_userId_idx" ON "TeamMember" USING btree ("teamId","userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "TeamMember_teamId_idx" ON "TeamMember" USING btree ("teamId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "TeamMember_userId_idx" ON "TeamMember" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_userId_idx" ON "Ticket" USING btree ("userId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_status_idx" ON "Ticket" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_priority_idx" ON "Ticket" USING btree ("priority");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_visibility_idx" ON "Ticket" USING btree ("visibility");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_due_date_idx" ON "Ticket" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_publish_source_idx" ON "Ticket" USING btree ("publish_source");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_review_status_idx" ON "Ticket" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_expiry_date_idx" ON "Ticket" USING btree ("expiry_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_is_deleted_idx" ON "Ticket" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_tag_relation_ticket_idx" ON "TicketTagRelation" USING btree ("ticketId");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ticket_tag_relation_tag_idx" ON "TicketTagRelation" USING btree ("tagId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_idx" ON "User" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "User_phone_idx" ON "User" USING btree ("phone") WHERE "User"."phone" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "User_accountType_idx" ON "User" USING btree ("accountType");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "User_enterpriseId_idx" ON "User" USING btree ("enterpriseId");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "UserKnowledge_userId_knowledgeId_idx" ON "UserKnowledge" USING btree ("userId","knowledge_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "UserKnowledge_userId_idx" ON "UserKnowledge" USING btree ("userId");