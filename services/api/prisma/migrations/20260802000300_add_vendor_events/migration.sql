-- CreateEnum
CREATE TYPE "vendor_event_type" AS ENUM ('vendor_payment_completed', 'pre_departure_reminder');

-- CreateTable
CREATE TABLE "vendor_events" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "event_type" "vendor_event_type" NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "vendor_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vendor_events_processed_at_idx" ON "vendor_events"("processed_at");
