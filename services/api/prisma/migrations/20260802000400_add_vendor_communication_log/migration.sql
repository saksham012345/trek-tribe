-- CreateEnum
CREATE TYPE "vendor_communication_status" AS ENUM ('sent', 'failed', 'pending');

-- CreateTable
CREATE TABLE "vendor_communication_log" (
    "id" TEXT NOT NULL,
    "assignment_id" TEXT,
    "vendor_id" TEXT NOT NULL,
    "event_type" "vendor_event_type" NOT NULL,
    "status" "vendor_communication_status" NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3),
    "email_snapshot" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vendor_communication_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_communication_log_vendor_id_idx" ON "vendor_communication_log"("vendor_id");

-- CreateIndex
CREATE INDEX "vendor_communication_log_assignment_id_idx" ON "vendor_communication_log"("assignment_id");
