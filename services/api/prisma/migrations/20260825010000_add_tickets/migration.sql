-- CreateEnum
CREATE TYPE "ticket_status" AS ENUM ('pending', 'in_progress', 'waiting_customer', 'resolved', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "ticket_category" AS ENUM ('booking', 'payment', 'verification', 'technical', 'inquiry', 'complaint', 'other');

-- CreateEnum
CREATE TYPE "ticket_requester_type" AS ENUM ('user', 'organizer');

-- CreateEnum
CREATE TYPE "ticket_sender_type" AS ENUM ('user', 'organizer', 'admin');

-- AlterEnum
BEGIN;
CREATE TYPE "support_status_new" AS ENUM ('open', 'in-progress', 'waiting-customer', 'resolved', 'closed');
ALTER TABLE "public"."support_tickets" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "support_tickets" ALTER COLUMN "status" TYPE "support_status_new" USING ("status"::text::"support_status_new");
ALTER TYPE "support_status" RENAME TO "support_status_old";
ALTER TYPE "support_status_new" RENAME TO "support_status";
DROP TYPE "public"."support_status_old";
ALTER TABLE "support_tickets" ALTER COLUMN "status" SET DEFAULT 'open';
COMMIT;

-- AlterTable
ALTER TABLE "support_tickets" ALTER COLUMN "ticket_id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "ticket_number" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ticket_category" NOT NULL,
    "priority" "support_priority" NOT NULL DEFAULT 'medium',
    "status" "ticket_status" NOT NULL DEFAULT 'pending',
    "requester_id" TEXT NOT NULL,
    "requester_type" "ticket_requester_type" NOT NULL,
    "assigned_to" TEXT,
    "trip_id" TEXT,
    "booking_id" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "sender_type" "ticket_sender_type" NOT NULL,
    "message" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_internal_notes" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "note_by" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_internal_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tickets_ticket_number_key" ON "tickets"("ticket_number");

-- CreateIndex
CREATE INDEX "tickets_requester_id_idx" ON "tickets"("requester_id");

-- CreateIndex
CREATE INDEX "tickets_assigned_to_idx" ON "tickets"("assigned_to");

-- CreateIndex
CREATE INDEX "tickets_status_idx" ON "tickets"("status");

-- CreateIndex
CREATE INDEX "tickets_trip_id_idx" ON "tickets"("trip_id");

-- CreateIndex
CREATE INDEX "ticket_messages_ticket_id_timestamp_idx" ON "ticket_messages"("ticket_id", "timestamp");

-- CreateIndex
CREATE INDEX "ticket_internal_notes_ticket_id_timestamp_idx" ON "ticket_internal_notes"("ticket_id", "timestamp");

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_internal_notes" ADD CONSTRAINT "ticket_internal_notes_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ticketNumber had no generator at all in Mongoose - it was `required: true,
-- unique: true` and left to whatever created the ticket. A sequence gives it the
-- same guarantee the support ticket ids now have.
CREATE SEQUENCE ticket_number_seq START 1;

ALTER TABLE "tickets"
  ALTER COLUMN "ticket_number"
  SET DEFAULT 'TKT-' || to_char(now(), 'YYMMDD') || '-' ||
      lpad(nextval('ticket_number_seq')::text, 4, '0');

ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_resolved_after_created"
  CHECK ("resolved_at" IS NULL OR "resolved_at" >= "created_at");
