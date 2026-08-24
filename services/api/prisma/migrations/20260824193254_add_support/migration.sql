-- CreateEnum
CREATE TYPE "support_category" AS ENUM ('booking', 'payment', 'technical', 'general', 'complaint', 'refund');

-- CreateEnum
CREATE TYPE "support_priority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "support_status" AS ENUM ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "support_sender" AS ENUM ('customer', 'agent');

-- CreateEnum
CREATE TYPE "chat_session_status" AS ENUM ('active', 'waiting_agent', 'with_agent', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "chat_sender" AS ENUM ('user', 'ai', 'agent');

-- CreateEnum
CREATE TYPE "chat_message_sender_type" AS ENUM ('user', 'organizer', 'admin');

-- CreateEnum
CREATE TYPE "chat_message_type" AS ENUM ('text', 'image', 'file', 'system');

-- CreateEnum
CREATE TYPE "chat_message_related_type" AS ENUM ('trip', 'booking', 'ticket');

-- CreateEnum
CREATE TYPE "ai_message_role" AS ENUM ('user', 'assistant', 'system');

-- DropIndex
DROP INDEX "blog_posts_tags_idx";

-- DropIndex
DROP INDEX "events_tags_idx";

-- DropIndex
DROP INDEX "groups_tags_idx";

-- DropIndex
DROP INDEX "knowledge_base_tags_idx";

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_agent_id" TEXT,
    "related_trip_id" TEXT,
    "related_booking_id" TEXT,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "support_category" NOT NULL DEFAULT 'general',
    "priority" "support_priority" NOT NULL DEFAULT 'medium',
    "status" "support_status" NOT NULL DEFAULT 'open',
    "customer_email" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "internal_notes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "first_response_time" TIMESTAMP(3),
    "resolution_time" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_ticket_messages" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "sender" "support_sender" NOT NULL,
    "sender_name" TEXT NOT NULL,
    "sender_id" TEXT,
    "message" VARCHAR(2000) NOT NULL,
    "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_sessions" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_name" TEXT,
    "user_email" TEXT,
    "status" "chat_session_status" NOT NULL DEFAULT 'active',
    "user_context" JSONB,
    "current_intent" TEXT,
    "last_activity" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_agent_id" TEXT,
    "handoff_reason" TEXT,
    "handoff_time" TIMESTAMP(3),
    "agent_joined_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_session_messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "sender" "chat_sender" NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_from_bot" BOOLEAN NOT NULL DEFAULT false,
    "agent_id" TEXT,
    "intent" TEXT,
    "confidence" DOUBLE PRECISION,
    "response_for" TEXT,
    "suggestions" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "chat_session_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_type" "chat_message_sender_type" NOT NULL,
    "recipient_id" TEXT,
    "recipient_type" "chat_message_sender_type",
    "message" TEXT NOT NULL,
    "message_type" "chat_message_type" NOT NULL DEFAULT 'text',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "related_to_type" "chat_message_related_type",
    "related_to_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_interaction_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "summary" JSONB,
    "context" JSONB NOT NULL DEFAULT '{}',
    "escalation" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversation_messages" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "role" "ai_message_role" NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "response_time" INTEGER,
    "topic" TEXT,
    "requires_human_agent" BOOLEAN,
    "sender" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ai_conversation_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_id_key" ON "support_tickets"("ticket_id");

-- CreateIndex
CREATE INDEX "support_tickets_user_id_idx" ON "support_tickets"("user_id");

-- CreateIndex
CREATE INDEX "support_tickets_assigned_agent_id_idx" ON "support_tickets"("assigned_agent_id");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_category_idx" ON "support_tickets"("category");

-- CreateIndex
CREATE INDEX "support_tickets_priority_idx" ON "support_tickets"("priority");

-- CreateIndex
CREATE INDEX "support_tickets_customer_email_idx" ON "support_tickets"("customer_email");

-- CreateIndex
CREATE INDEX "support_ticket_messages_ticket_id_timestamp_idx" ON "support_ticket_messages"("ticket_id", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "chat_sessions_session_id_key" ON "chat_sessions"("session_id");

-- CreateIndex
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions"("user_id");

-- CreateIndex
CREATE INDEX "chat_sessions_status_idx" ON "chat_sessions"("status");

-- CreateIndex
CREATE INDEX "chat_sessions_assigned_agent_id_idx" ON "chat_sessions"("assigned_agent_id");

-- CreateIndex
CREATE INDEX "chat_session_messages_session_id_timestamp_idx" ON "chat_session_messages"("session_id", "timestamp");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_id_created_at_idx" ON "chat_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "chat_messages_sender_id_idx" ON "chat_messages"("sender_id");

-- CreateIndex
CREATE INDEX "chat_messages_is_read_idx" ON "chat_messages"("is_read");

-- CreateIndex
CREATE UNIQUE INDEX "ai_conversations_session_id_key" ON "ai_conversations"("session_id");

-- CreateIndex
CREATE INDEX "ai_conversations_user_id_idx" ON "ai_conversations"("user_id");

-- CreateIndex
CREATE INDEX "ai_conversations_expires_at_idx" ON "ai_conversations"("expires_at");

-- CreateIndex
CREATE INDEX "ai_conversations_last_interaction_at_idx" ON "ai_conversations"("last_interaction_at");

-- CreateIndex
CREATE INDEX "ai_conversation_messages_conversation_id_timestamp_idx" ON "ai_conversation_messages"("conversation_id", "timestamp");

-- AddForeignKey
ALTER TABLE "support_ticket_messages" ADD CONSTRAINT "support_ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_session_messages" ADD CONSTRAINT "chat_session_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversation_messages" ADD CONSTRAINT "ai_conversation_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The Mongoose pre-save hook built ticketId from countDocuments() + 1 joined to
-- a millisecond timestamp. Two tickets created in the same millisecond read the
-- same count and produced the same id, and the unique index then rejected one of
-- them - a race that only shows up under load, which is exactly when support
-- tickets arrive in bursts.
--
-- A sequence hands out each number once, without a count query and without a
-- race. The format is kept so existing ids and any saved links still read the
-- same shape.
CREATE SEQUENCE support_ticket_number_seq START 1;

ALTER TABLE "support_tickets"
  ALTER COLUMN "ticket_id"
  SET DEFAULT 'TT-' || to_char(now(), 'YYMMDD') || '-' ||
      lpad(nextval('support_ticket_number_seq')::text, 4, '0');

-- A ticket cannot be resolved before it was raised, or closed before resolved.
ALTER TABLE "support_tickets"
  ADD CONSTRAINT "support_tickets_resolved_after_created"
  CHECK ("resolved_at" IS NULL OR "resolved_at" >= "created_at");

-- confidence is a probability. Mongoose said min 0 / max 1 and meant it as a
-- validation; here it holds regardless of who writes.
ALTER TABLE "chat_session_messages"
  ADD CONSTRAINT "chat_session_messages_confidence_0_to_1"
  CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1));

-- Text search over ticket subject and description, which subject: index 'text'
-- declared in Mongoose. Same two rules as every other text index here: the
-- regconfig is cast so the expression is IMMUTABLE.
CREATE INDEX "support_tickets_search_idx" ON "support_tickets"
  USING GIN (to_tsvector('english'::regconfig, "subject" || ' ' || "description"));
