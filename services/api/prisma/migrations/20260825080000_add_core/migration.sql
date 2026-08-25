-- CreateEnum
CREATE TYPE "trip_difficulty" AS ENUM ('easy', 'moderate', 'hard');

-- CreateEnum
CREATE TYPE "trip_status" AS ENUM ('pending', 'active', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "trip_approval_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "experience_level" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "trip_payment_type" AS ENUM ('full', 'advance');

-- CreateEnum
CREATE TYPE "trip_stop_kind" AS ENUM ('pickup', 'dropoff');

-- CreateEnum
CREATE TYPE "booking_payment_status" AS ENUM ('pending', 'partial', 'completed', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "booking_verification_status" AS ENUM ('pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "booking_status" AS ENUM ('confirmed', 'pending', 'cancelled', 'completed');

-- CreateEnum
CREATE TYPE "booking_refund_status" AS ENUM ('pending', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "participant_gender" AS ENUM ('male', 'female', 'other', 'prefer-not-to-say');

-- CreateEnum
CREATE TYPE "custom_request_status" AS ENUM ('open', 'assigned_to_organizers', 'proposal_selected', 'needs_review', 'converted', 'cancelled');

-- CreateEnum
CREATE TYPE "custom_trip_type" AS ENUM ('relaxed', 'adventure', 'cultural', 'religious', 'wildlife', 'mixed');

-- CreateEnum
CREATE TYPE "custom_age_group" AS ENUM ('18-25', '25-40', '40-60', 'family', 'seniors', 'mixed');

-- CreateEnum
CREATE TYPE "custom_privacy_level" AS ENUM ('private', 'invite-only');

-- CreateEnum
CREATE TYPE "proposal_status" AS ENUM ('pending', 'accepted', 'rejected');

-- CreateEnum
CREATE TYPE "trip_verification_status" AS ENUM ('pending', 'under_review', 'verified', 'rejected', 'revision_required');

-- CreateEnum
CREATE TYPE "trip_verification_priority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "trip_document_type" AS ENUM ('license', 'insurance', 'permits', 'id_proof', 'business_registration', 'other');

-- CreateEnum
CREATE TYPE "checklist_item_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "verification_action" AS ENUM ('submitted', 'under_review', 'verified', 'rejected', 'revision_requested');

-- CreateEnum
CREATE TYPE "verification_request_type" AS ENUM ('initial', 'kyc_update', 're_verification');

-- CreateEnum
CREATE TYPE "verification_request_status" AS ENUM ('pending', 'under_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "verification_request_priority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "kyc_document_type" AS ENUM ('pan', 'aadhar', 'business_proof', 'bank_statement', 'gst');

-- AlterTable
ALTER TABLE "support_tickets" ALTER COLUMN "ticket_id" SET DEFAULT ('TT-'::text || to_char(now(), 'YYMMDD'::text) || '-'::text || lpad((nextval('support_ticket_number_seq'::regclass))::text, 4, '0'::text));

-- AlterTable
ALTER TABLE "tickets" ALTER COLUMN "ticket_number" SET DEFAULT ('TKT-'::text || to_char(now(), 'YYMMDD'::text) || '-'::text || lpad((nextval('ticket_number_seq'::regclass))::text, 4, '0'::text));

-- CreateTable
CREATE TABLE "trips" (
    "id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "difficulty" "trip_difficulty" NOT NULL DEFAULT 'moderate',
    "categories" TEXT[],
    "destination" TEXT NOT NULL,
    "longitude" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "images" TEXT[],
    "cover_image" TEXT,
    "itinerary" TEXT,
    "itinerary_pdf" TEXT,
    "itinerary_pdf_filename" TEXT,
    "itinerary_pdf_uploaded_at" TIMESTAMP(3),
    "capacity" INTEGER NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "minimum_age" INTEGER,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "status" "trip_status" NOT NULL DEFAULT 'pending',
    "average_rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "thumbnail" TEXT,
    "verification_status" "trip_approval_status" NOT NULL DEFAULT 'pending',
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "admin_notes" VARCHAR(1000),
    "payment_type" "trip_payment_type" NOT NULL DEFAULT 'full',
    "advance_amount" DECIMAL(14,2),
    "payment_due_date" TIMESTAMP(3),
    "refund_policy" TEXT,
    "payment_methods" TEXT[] DEFAULT ARRAY['upi']::TEXT[],
    "payment_instructions" TEXT,
    "gateway_qr_amount" DECIMAL(14,2),
    "gateway_qr_currency" VARCHAR(3),
    "gateway_qr_reference_id" TEXT,
    "gateway_qr_url" TEXT,
    "gateway_qr_generated_at" TIMESTAMP(3),
    "has_insurance" BOOLEAN NOT NULL DEFAULT false,
    "insurance_details" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "medical_facilities_nearby" TEXT,
    "safety_equipment" TEXT[],
    "covid_protocol" TEXT,
    "safety_disclaimer" TEXT NOT NULL,
    "content_hash" TEXT,
    "is_duplicate" BOOLEAN NOT NULL DEFAULT false,
    "original_trip_id" TEXT,
    "is_private" BOOLEAN NOT NULL DEFAULT false,
    "allowed_user_ids" TEXT[],
    "slug" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_participants" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emergency_contact_name" TEXT,
    "emergency_contact_phone" TEXT,
    "medical_conditions" TEXT,
    "dietary_restrictions" TEXT,
    "experience_level" "experience_level",
    "special_requests" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_schedule_days" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "activities" TEXT[],

    CONSTRAINT "trip_schedule_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_packages" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "package_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(14,2) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "inclusions" TEXT[],
    "exclusions" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "trip_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_stops" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "kind" "trip_stop_kind" NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "longitude" DOUBLE PRECISION,
    "latitude" DOUBLE PRECISION,
    "time" TEXT,
    "contact_person" TEXT,
    "contact_phone" TEXT,
    "landmarks" TEXT,
    "instructions" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "trip_stops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_live_photos" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "caption" VARCHAR(200),
    "location" TEXT,
    "is_thumbnail" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_live_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_bookings" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "main_booker_id" TEXT NOT NULL,
    "number_of_guests" INTEGER NOT NULL,
    "selected_package_id" TEXT,
    "package_name" TEXT,
    "total_amount" DECIMAL(14,2) NOT NULL,
    "price_per_person" DECIMAL(14,2) NOT NULL,
    "group_discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "final_amount" DECIMAL(14,2) NOT NULL,
    "paid_amount" DECIMAL(14,2),
    "payment_type" "trip_payment_type" NOT NULL DEFAULT 'full',
    "advance_amount" DECIMAL(14,2),
    "remaining_amount" DECIMAL(14,2),
    "payment_status" "booking_payment_status" NOT NULL DEFAULT 'pending',
    "payment_method" TEXT NOT NULL,
    "payment_transaction_id" TEXT,
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "transaction_date" TIMESTAMP(3),
    "payment_gateway" TEXT,
    "gateway_transaction_id" TEXT,
    "payment_reference" TEXT,
    "screenshot_filename" TEXT,
    "screenshot_original_name" TEXT,
    "screenshot_url" TEXT,
    "screenshot_uploaded_at" TIMESTAMP(3),
    "payment_verification_status" "booking_verification_status" NOT NULL DEFAULT 'pending',
    "payment_verification_notes" TEXT,
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "verification_notes" TEXT,
    "rejection_reason" TEXT,
    "booking_status" "booking_status" NOT NULL DEFAULT 'pending',
    "special_requests" TEXT,
    "notes" TEXT,
    "cancellation_reason" TEXT,
    "cancellation_date" TIMESTAMP(3),
    "refund_amount" DECIMAL(14,2),
    "refund_status" "booking_refund_status",
    "trip_start_24h_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_participants" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3),
    "gender" "participant_gender",
    "emergency_contact_name" TEXT NOT NULL,
    "emergency_contact_phone" TEXT NOT NULL,
    "medical_conditions" TEXT,
    "dietary_restrictions" TEXT,
    "experience_level" "experience_level" NOT NULL,
    "special_requests" TEXT,
    "is_main_booker" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "booking_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_trip_requests" (
    "id" TEXT NOT NULL,
    "traveler_id" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "flexible_dates" BOOLEAN NOT NULL DEFAULT false,
    "budget" DECIMAL(14,2),
    "number_of_travelers" INTEGER NOT NULL DEFAULT 1,
    "trip_type" "custom_trip_type" NOT NULL DEFAULT 'mixed',
    "experience_level" "experience_level" NOT NULL DEFAULT 'beginner',
    "age_group" "custom_age_group" NOT NULL DEFAULT 'mixed',
    "special_needs" TEXT,
    "privacy_level" "custom_privacy_level" NOT NULL DEFAULT 'private',
    "preferences" TEXT,
    "status" "custom_request_status" NOT NULL DEFAULT 'open',
    "admin_notes" TEXT,
    "assigned_organizers" TEXT[],
    "converted_trip_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_trip_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_trip_proposals" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "itinerary_summary" TEXT NOT NULL,
    "inclusions" TEXT[],
    "exclusions" TEXT[],
    "value_statement" VARCHAR(500) NOT NULL,
    "price_breakdown" TEXT,
    "cancellation_policy" TEXT NOT NULL,
    "valid_until" TIMESTAMP(3),
    "stay_type" TEXT,
    "comfort_level" TEXT,
    "transport_type" TEXT,
    "max_group_size" TEXT,
    "safety_plan_present" BOOLEAN NOT NULL DEFAULT false,
    "status" "proposal_status" NOT NULL DEFAULT 'pending',
    "sealed" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_trip_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_verifications" (
    "id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "status" "trip_verification_status" NOT NULL DEFAULT 'pending',
    "priority" "trip_verification_priority" NOT NULL DEFAULT 'medium',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "rejection_reason" TEXT,
    "revision_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_verification_documents" (
    "id" TEXT NOT NULL,
    "verification_id" TEXT NOT NULL,
    "type" "trip_document_type" NOT NULL,
    "filename" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_verification_checklist_items" (
    "id" TEXT NOT NULL,
    "verification_id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "status" "checklist_item_status" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "checked_by" TEXT,
    "checked_at" TIMESTAMP(3),

    CONSTRAINT "trip_verification_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trip_verification_reviews" (
    "id" TEXT NOT NULL,
    "verification_id" TEXT NOT NULL,
    "reviewed_by" TEXT NOT NULL,
    "action" "verification_action" NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trip_verification_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "organizer_name" TEXT NOT NULL,
    "organizer_email" TEXT NOT NULL,
    "request_type" "verification_request_type" NOT NULL DEFAULT 'initial',
    "status" "verification_request_status" NOT NULL DEFAULT 'pending',
    "priority" "verification_request_priority" NOT NULL DEFAULT 'medium',
    "pan_number" TEXT,
    "business_name" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "admin_notes" TEXT,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "approval_notes" TEXT,
    "rejection_reason" TEXT,
    "initial_trust_score" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_request_documents" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "type" "kyc_document_type" NOT NULL,
    "url" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "rejection_reason" TEXT,

    CONSTRAINT "verification_request_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trips_slug_key" ON "trips"("slug");

-- CreateIndex
CREATE INDEX "trips_status_start_date_idx" ON "trips"("status", "start_date");

-- CreateIndex
CREATE INDEX "trips_status_destination_start_date_idx" ON "trips"("status", "destination", "start_date");

-- CreateIndex
CREATE INDEX "trips_organizer_id_created_at_idx" ON "trips"("organizer_id", "created_at");

-- CreateIndex
CREATE INDEX "trips_organizer_id_status_idx" ON "trips"("organizer_id", "status");

-- CreateIndex
CREATE INDEX "trips_destination_idx" ON "trips"("destination");

-- CreateIndex
CREATE INDEX "trips_price_idx" ON "trips"("price");

-- CreateIndex
CREATE INDEX "trips_difficulty_idx" ON "trips"("difficulty");

-- CreateIndex
CREATE INDEX "trips_content_hash_idx" ON "trips"("content_hash");

-- CreateIndex
CREATE INDEX "trips_is_duplicate_idx" ON "trips"("is_duplicate");

-- CreateIndex
CREATE INDEX "trips_is_private_idx" ON "trips"("is_private");

-- CreateIndex
CREATE INDEX "trips_verification_status_idx" ON "trips"("verification_status");

-- CreateIndex
CREATE INDEX "trips_average_rating_created_at_idx" ON "trips"("average_rating", "created_at");

-- CreateIndex
CREATE INDEX "trip_participants_user_id_joined_at_idx" ON "trip_participants"("user_id", "joined_at");

-- CreateIndex
CREATE UNIQUE INDEX "trip_participants_trip_id_user_id_key" ON "trip_participants"("trip_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_schedule_days_trip_id_day_key" ON "trip_schedule_days"("trip_id", "day");

-- CreateIndex
CREATE INDEX "trip_packages_trip_id_sort_order_idx" ON "trip_packages"("trip_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "trip_packages_trip_id_package_key_key" ON "trip_packages"("trip_id", "package_key");

-- CreateIndex
CREATE INDEX "trip_stops_trip_id_kind_sort_order_idx" ON "trip_stops"("trip_id", "kind", "sort_order");

-- CreateIndex
CREATE INDEX "trip_live_photos_trip_id_uploaded_at_idx" ON "trip_live_photos"("trip_id", "uploaded_at");

-- CreateIndex
CREATE UNIQUE INDEX "group_bookings_razorpay_payment_id_key" ON "group_bookings"("razorpay_payment_id");

-- CreateIndex
CREATE INDEX "group_bookings_trip_id_created_at_idx" ON "group_bookings"("trip_id", "created_at");

-- CreateIndex
CREATE INDEX "group_bookings_main_booker_id_created_at_idx" ON "group_bookings"("main_booker_id", "created_at");

-- CreateIndex
CREATE INDEX "group_bookings_payment_status_booking_status_idx" ON "group_bookings"("payment_status", "booking_status");

-- CreateIndex
CREATE INDEX "group_bookings_payment_verification_status_idx" ON "group_bookings"("payment_verification_status");

-- CreateIndex
CREATE UNIQUE INDEX "group_bookings_main_booker_id_trip_id_key" ON "group_bookings"("main_booker_id", "trip_id");

-- CreateIndex
CREATE INDEX "booking_participants_booking_id_idx" ON "booking_participants"("booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "booking_participants_booking_id_email_key" ON "booking_participants"("booking_id", "email");

-- CreateIndex
CREATE INDEX "custom_trip_requests_traveler_id_created_at_idx" ON "custom_trip_requests"("traveler_id", "created_at");

-- CreateIndex
CREATE INDEX "custom_trip_requests_status_idx" ON "custom_trip_requests"("status");

-- CreateIndex
CREATE INDEX "custom_trip_proposals_request_id_status_idx" ON "custom_trip_proposals"("request_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "custom_trip_proposals_request_id_organizer_id_key" ON "custom_trip_proposals"("request_id", "organizer_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_verifications_trip_id_key" ON "trip_verifications"("trip_id");

-- CreateIndex
CREATE INDEX "trip_verifications_organizer_id_idx" ON "trip_verifications"("organizer_id");

-- CreateIndex
CREATE INDEX "trip_verifications_status_idx" ON "trip_verifications"("status");

-- CreateIndex
CREATE INDEX "trip_verifications_submitted_at_idx" ON "trip_verifications"("submitted_at");

-- CreateIndex
CREATE INDEX "trip_verification_documents_verification_id_idx" ON "trip_verification_documents"("verification_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_verification_checklist_items_verification_id_item_name_key" ON "trip_verification_checklist_items"("verification_id", "item_name");

-- CreateIndex
CREATE INDEX "trip_verification_reviews_verification_id_timestamp_idx" ON "trip_verification_reviews"("verification_id", "timestamp");

-- CreateIndex
CREATE INDEX "verification_requests_status_created_at_idx" ON "verification_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "verification_requests_organizer_id_created_at_idx" ON "verification_requests"("organizer_id", "created_at");

-- CreateIndex
CREATE INDEX "verification_requests_priority_status_idx" ON "verification_requests"("priority", "status");

-- CreateIndex
CREATE INDEX "verification_request_documents_request_id_idx" ON "verification_request_documents"("request_id");

-- AddForeignKey
ALTER TABLE "trip_participants" ADD CONSTRAINT "trip_participants_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_schedule_days" ADD CONSTRAINT "trip_schedule_days_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_packages" ADD CONSTRAINT "trip_packages_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_stops" ADD CONSTRAINT "trip_stops_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_live_photos" ADD CONSTRAINT "trip_live_photos_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_bookings" ADD CONSTRAINT "group_bookings_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_participants" ADD CONSTRAINT "booking_participants_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "group_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_trip_proposals" ADD CONSTRAINT "custom_trip_proposals_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "custom_trip_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_verification_documents" ADD CONSTRAINT "trip_verification_documents_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "trip_verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_verification_checklist_items" ADD CONSTRAINT "trip_verification_checklist_items_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "trip_verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trip_verification_reviews" ADD CONSTRAINT "trip_verification_reviews_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "trip_verifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_request_documents" ADD CONSTRAINT "verification_request_documents_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "verification_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Constraints and triggers Prisma does not model ───────────────────────────

-- ═══ Trips ═══════════════════════════════════════════════════════════════════

ALTER TABLE "trips" ADD CONSTRAINT "trips_capacity_positive" CHECK ("capacity" > 0);
ALTER TABLE "trips" ADD CONSTRAINT "trips_price_nonneg" CHECK ("price" >= 0);
ALTER TABLE "trips" ADD CONSTRAINT "trips_dates_ordered" CHECK ("end_date" >= "start_date");
ALTER TABLE "trips" ADD CONSTRAINT "trips_rating_range"
  CHECK ("average_rating" >= 0 AND "average_rating" <= 5 AND "review_count" >= 0);
ALTER TABLE "trips" ADD CONSTRAINT "trips_minimum_age_range"
  CHECK ("minimum_age" IS NULL OR ("minimum_age" >= 1 AND "minimum_age" <= 100));
-- Longitude and latitude are only meaningful together, and only inside the
-- ranges a coordinate can occupy. The GeoJSON array this replaces could hold
-- any two numbers in any order.
ALTER TABLE "trips" ADD CONSTRAINT "trips_coordinates_paired"
  CHECK (("longitude" IS NULL) = ("latitude" IS NULL));
ALTER TABLE "trips" ADD CONSTRAINT "trips_coordinates_range"
  CHECK (
    "longitude" IS NULL OR
    ("longitude" >= -180 AND "longitude" <= 180 AND "latitude" >= -90 AND "latitude" <= 90)
  );
-- An advance payment needs an amount, and it cannot exceed the price.
ALTER TABLE "trips" ADD CONSTRAINT "trips_advance_within_price"
  CHECK ("advance_amount" IS NULL OR ("advance_amount" >= 0 AND "advance_amount" <= "price"));

ALTER TABLE "trip_packages" ADD CONSTRAINT "trip_packages_price_nonneg" CHECK ("price" >= 0);
ALTER TABLE "trip_packages" ADD CONSTRAINT "trip_packages_capacity_positive" CHECK ("capacity" >= 1);

ALTER TABLE "trip_schedule_days" ADD CONSTRAINT "trip_schedule_days_day_positive" CHECK ("day" >= 1);

-- "The first uploaded photo is the thumbnail" was a rule the upload path kept.
-- At most one thumbnail per trip, said by the database.
CREATE UNIQUE INDEX "trip_live_photos_one_thumbnail"
  ON "trip_live_photos" ("trip_id") WHERE "is_thumbnail";

-- Full-text search over the three fields Mongo's text index covered. The same
-- shape as the knowledge-base and review searches from earlier waves: an
-- explicit 'english'::regconfig, because to_tsvector(text) is STABLE rather
-- than IMMUTABLE and cannot be indexed.
CREATE INDEX "trips_search_idx" ON "trips"
  USING GIN (
    to_tsvector(
      'english'::regconfig,
      coalesce("title", '') || ' ' || coalesce("description", '') || ' ' || coalesce("destination", '')
    )
  );

-- ═══ Trip participants ═══════════════════════════════════════════════════════

-- Capacity is not a CHECK - it spans two tables - so it is enforced by
-- joinTrip() taking a row lock on the trip before counting. See
-- src/services/tripParticipationService.ts. What the unique index above
-- guarantees is the other half: one row per user per trip, so the same person
-- cannot occupy two seats.

-- ═══ Group bookings ══════════════════════════════════════════════════════════

ALTER TABLE "group_bookings" ADD CONSTRAINT "group_bookings_guests_range"
  CHECK ("number_of_guests" >= 1 AND "number_of_guests" <= 20);
ALTER TABLE "group_bookings" ADD CONSTRAINT "group_bookings_amounts_nonneg"
  CHECK (
    "total_amount" >= 0 AND "price_per_person" >= 0 AND "discount_amount" >= 0
    AND "final_amount" >= 0 AND ("paid_amount" IS NULL OR "paid_amount" >= 0)
    AND ("refund_amount" IS NULL OR "refund_amount" >= 0)
  );
ALTER TABLE "group_bookings" ADD CONSTRAINT "group_bookings_discount_range"
  CHECK ("group_discount" >= 0 AND "group_discount" <= 100);

-- The arithmetic the pre-save hook performed, stated as a constraint.
--
-- The hook ran on save and recomputed all four numbers, which meant the numbers
-- were right after any save and unverified at every other moment - including
-- after an updateOne, which does not fire it at all.
ALTER TABLE "group_bookings" ADD CONSTRAINT "group_bookings_total_adds_up"
  CHECK ("total_amount" = "price_per_person" * "number_of_guests");
ALTER TABLE "group_bookings" ADD CONSTRAINT "group_bookings_discount_adds_up"
  CHECK ("discount_amount" = round("total_amount" * "group_discount" / 100, 2));
ALTER TABLE "group_bookings" ADD CONSTRAINT "group_bookings_final_adds_up"
  CHECK ("final_amount" = "total_amount" - "discount_amount");
ALTER TABLE "group_bookings" ADD CONSTRAINT "group_bookings_remaining_adds_up"
  CHECK (
    "remaining_amount" IS NULL
    OR "advance_amount" IS NULL
    OR "remaining_amount" = "final_amount" - "advance_amount"
  );
-- Nobody can be refunded more than they paid.
ALTER TABLE "group_bookings" ADD CONSTRAINT "group_bookings_refund_within_paid"
  CHECK (
    "refund_amount" IS NULL OR "paid_amount" IS NULL OR "refund_amount" <= "paid_amount"
  );

-- Exactly one main booker per booking. transferMainBooker cleared one flag and
-- set another as two separate writes on a loaded document; a failure between
-- them left a booking with none, or with two.
CREATE UNIQUE INDEX "booking_participants_one_main_booker"
  ON "booking_participants" ("booking_id") WHERE "is_main_booker";

-- ═══ Custom trip requests ════════════════════════════════════════════════════

ALTER TABLE "custom_trip_requests" ADD CONSTRAINT "custom_trip_requests_travelers_positive"
  CHECK ("number_of_travelers" >= 1);
ALTER TABLE "custom_trip_requests" ADD CONSTRAINT "custom_trip_requests_budget_nonneg"
  CHECK ("budget" IS NULL OR "budget" >= 0);
ALTER TABLE "custom_trip_requests" ADD CONSTRAINT "custom_trip_requests_dates_ordered"
  CHECK ("start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date");

ALTER TABLE "custom_trip_proposals" ADD CONSTRAINT "custom_trip_proposals_price_nonneg"
  CHECK ("price" >= 0);
-- At most one accepted proposal per request. "proposal_selected" is a status on
-- the request, and accepting a second proposal was prevented only by the route
-- checking first.
CREATE UNIQUE INDEX "custom_trip_proposals_one_accepted"
  ON "custom_trip_proposals" ("request_id") WHERE "status" = 'accepted';

-- ═══ Verification requests ═══════════════════════════════════════════════════

ALTER TABLE "verification_requests" ADD CONSTRAINT "verification_requests_trust_score_range"
  CHECK ("initial_trust_score" IS NULL OR ("initial_trust_score" >= 0 AND "initial_trust_score" <= 100));

-- ═══ Ratings, maintained by the database ═════════════════════════════════════
--
-- average_rating and review_count were denormalized onto the trip and kept in
-- step by whichever code path wrote a review. Review moved to Postgres in wave
-- 4 while Trip stayed in Mongo, so for the length of this migration nothing was
-- keeping them in step at all - a trip's rating could only be whatever it was
-- when the two models last lived in the same database.
--
-- Both tables are here now, so the counters are computed by the database and
-- cannot drift from the rows they summarise. A trigger rather than application
-- code because routes/ai.ts sorts every trip by average_rating, which needs a
-- column rather than a computed value, and because there is more than one path
-- that writes a review.

-- A trip review is (review_type = 'trip', target_id = the trip). It is NOT
-- reviews.trip_id: that column exists on the model and no code path writes it,
-- so keying the trigger on it would have left every rating at zero - which is
-- the exact bug this trigger exists to fix, reintroduced one column over. I had
-- it wrong that way first; the review create route is what settled it.
CREATE OR REPLACE FUNCTION refresh_trip_rating(reviewed_trip_id text)
RETURNS void AS $$
BEGIN
  IF reviewed_trip_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE trips
     SET average_rating = COALESCE((
           SELECT round(avg(rating)::numeric, 2)
             FROM reviews
            WHERE target_id = reviewed_trip_id AND review_type = 'trip'
         ), 0),
         review_count = (
           SELECT count(*)
             FROM reviews
            WHERE target_id = reviewed_trip_id AND review_type = 'trip'
         )
   WHERE id = reviewed_trip_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trip_rating_trigger()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.review_type = 'trip' THEN
      PERFORM refresh_trip_rating(OLD.target_id);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.review_type = 'trip' THEN
    PERFORM refresh_trip_rating(NEW.target_id);
  END IF;

  -- A review retargeted at another trip - or changed from a trip review to an
  -- organizer one - has to bring the old trip down as well as the new one up.
  IF TG_OP = 'UPDATE'
     AND OLD.review_type = 'trip'
     AND (OLD.target_id IS DISTINCT FROM NEW.target_id OR NEW.review_type <> 'trip')
  THEN
    PERFORM refresh_trip_rating(OLD.target_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_maintain_trip_rating
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION trip_rating_trigger();
