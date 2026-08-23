-- CreateEnum
CREATE TYPE "lead_source" AS ENUM ('trip_view', 'inquiry', 'partial_booking', 'chat', 'form', 'other');

-- CreateEnum
CREATE TYPE "lead_status" AS ENUM ('new', 'contacted', 'interested', 'not_interested', 'converted', 'lost');

-- CreateEnum
CREATE TYPE "lead_pipeline_stage" AS ENUM ('new', 'contacted', 'interested', 'negotiating', 'booked', 'lost');

-- CreateEnum
CREATE TYPE "lead_kyc_status" AS ENUM ('pending', 'verified', 'rejected', 'not_required');

-- CreateEnum
CREATE TYPE "lead_interaction_type" AS ENUM ('email', 'call', 'chat', 'message', 'visit');

-- CreateEnum
CREATE TYPE "lead_event_type" AS ENUM ('trip_viewed', 'chat_message', 'inquiry_submitted', 'email_opened', 'booking_started', 'booking_abandoned');

-- CreateEnum
CREATE TYPE "import_file_type" AS ENUM ('csv', 'xlsx', 'json');

-- CreateEnum
CREATE TYPE "import_status" AS ENUM ('pending', 'processing', 'completed', 'failed', 'partially_completed');

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "trip_id" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT,
    "source" "lead_source" NOT NULL,
    "status" "lead_status" NOT NULL DEFAULT 'new',
    "lead_score" INTEGER NOT NULL DEFAULT 0,
    "pipeline_stage" "lead_pipeline_stage" NOT NULL DEFAULT 'new',
    "trip_view_count" INTEGER NOT NULL DEFAULT 0,
    "last_visited_at" TIMESTAMP(3),
    "inquiry_message" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "kyc_status" "lead_kyc_status" NOT NULL DEFAULT 'pending',
    "partial_form_data" JSONB,
    "traveler_details" JSONB,
    "kyc_details" JSONB,
    "assigned_to" TEXT,
    "converted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_interactions" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "type" "lead_interaction_type" NOT NULL,
    "description" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "event_type" "lead_event_type" NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imported_databases" (
    "id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_type" "import_file_type" NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "import_status" NOT NULL DEFAULT 'pending',
    "stats_total_records" INTEGER NOT NULL DEFAULT 0,
    "stats_successful_imports" INTEGER NOT NULL DEFAULT 0,
    "stats_failed_imports" INTEGER NOT NULL DEFAULT 0,
    "stats_duplicates_skipped" INTEGER NOT NULL DEFAULT 0,
    "field_mapping" JSONB NOT NULL DEFAULT '[]',
    "import_config" JSONB NOT NULL DEFAULT '{}',
    "errors" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imported_databases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_trip_id_idx" ON "leads"("trip_id");

-- CreateIndex
CREATE INDEX "leads_assigned_to_idx" ON "leads"("assigned_to");

-- CreateIndex
CREATE INDEX "leads_lead_score_idx" ON "leads"("lead_score");

-- CreateIndex
CREATE INDEX "leads_source_idx" ON "leads"("source");

-- CreateIndex
CREATE INDEX "leads_pipeline_stage_idx" ON "leads"("pipeline_stage");

-- CreateIndex
CREATE INDEX "leads_created_at_idx" ON "leads"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "leads_email_assigned_to_key" ON "leads"("email", "assigned_to");

-- CreateIndex
CREATE INDEX "lead_interactions_lead_id_timestamp_idx" ON "lead_interactions"("lead_id", "timestamp");

-- CreateIndex
CREATE INDEX "lead_activities_lead_id_timestamp_idx" ON "lead_activities"("lead_id", "timestamp");

-- CreateIndex
CREATE INDEX "lead_activities_event_type_idx" ON "lead_activities"("event_type");

-- CreateIndex
CREATE INDEX "imported_databases_organizer_id_idx" ON "imported_databases"("organizer_id");

-- CreateIndex
CREATE INDEX "imported_databases_status_idx" ON "imported_databases"("status");

-- AddForeignKey
ALTER TABLE "lead_interactions" ADD CONSTRAINT "lead_interactions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- leadScore was `min: 0, max: 100` in Mongoose - a model validation, so a score
-- written another way could sit outside the range the pipeline UI renders.
ALTER TABLE "leads"
  ADD CONSTRAINT "leads_score_0_to_100" CHECK ("lead_score" BETWEEN 0 AND 100);

-- Email is stored lowercase by the model. Make that true of the column, so a
-- lead imported with a capitalised address still collides with its duplicate
-- rather than sitting beside it.
ALTER TABLE "leads"
  ADD CONSTRAINT "leads_email_lowercase" CHECK ("email" = lower("email"));

-- Import counters cannot be negative, and the parts cannot exceed the whole.
-- A report claiming 12 successes out of 10 records is worse than an error.
ALTER TABLE "imported_databases"
  ADD CONSTRAINT "imported_databases_stats_non_negative" CHECK (
    "stats_total_records" >= 0 AND "stats_successful_imports" >= 0
    AND "stats_failed_imports" >= 0 AND "stats_duplicates_skipped" >= 0
  );

ALTER TABLE "imported_databases"
  ADD CONSTRAINT "imported_databases_stats_within_total" CHECK (
    "stats_successful_imports" + "stats_failed_imports" + "stats_duplicates_skipped"
      <= "stats_total_records"
  );
