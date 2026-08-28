-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('traveler', 'organizer', 'admin', 'agent');

-- CreateEnum
CREATE TYPE "id_verification_status" AS ENUM ('not_verified', 'pending', 'verified', 'rejected');

-- CreateEnum
CREATE TYPE "id_document_type" AS ENUM ('aadhaar', 'pan', 'passport', 'driving_license', 'voter_id');

-- CreateEnum
CREATE TYPE "profile_visibility" AS ENUM ('public', 'private', 'friends');

-- CreateEnum
CREATE TYPE "organizer_verification_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "verification_badge" AS ENUM ('none', 'bronze', 'silver', 'gold', 'platinum');

-- AlterTable
ALTER TABLE "support_tickets" ALTER COLUMN "ticket_id" SET DEFAULT ('TT-'::text || to_char(now(), 'YYMMDD'::text) || '-'::text || lpad((nextval('support_ticket_number_seq'::regclass))::text, 4, '0'::text));

-- AlterTable
ALTER TABLE "tickets" ALTER COLUMN "ticket_number" SET DEFAULT ('TKT-'::text || to_char(now(), 'YYMMDD'::text) || '-'::text || lpad((nextval('ticket_number_seq'::regclass))::text, 4, '0'::text));

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'traveler',
    "phone" TEXT,
    "bio" TEXT,
    "profile_photo" TEXT,
    "cover_photo" TEXT,
    "location" TEXT,
    "date_of_birth" DATE,
    "gender" "participant_gender",
    "occupation" TEXT,
    "unique_url" TEXT,
    "emergency_contact_name" TEXT,
    "emergency_contact_relationship" TEXT,
    "emergency_contact_phone" TEXT,
    "emergency_contact_email" TEXT,
    "trips_completed" INTEGER NOT NULL DEFAULT 0,
    "total_distance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "favorite_destinations" TEXT[],
    "travel_badges" TEXT[],
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "average_rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "preferred_categories" TEXT[],
    "budget_min" DECIMAL(14,2),
    "budget_max" DECIMAL(14,2),
    "preferred_locations" TEXT[],
    "preferred_difficulty_levels" "experience_level"[],
    "preferred_accommodation_types" TEXT[],
    "preferred_trip_durations" TEXT[],
    "notify_email" BOOLEAN NOT NULL DEFAULT true,
    "notify_sms" BOOLEAN NOT NULL DEFAULT false,
    "notify_push" BOOLEAN NOT NULL DEFAULT true,
    "notify_trip_updates" BOOLEAN NOT NULL DEFAULT true,
    "notify_promotions" BOOLEAN NOT NULL DEFAULT false,
    "social_instagram" TEXT,
    "social_facebook" TEXT,
    "social_twitter" TEXT,
    "social_linkedin" TEXT,
    "social_website" TEXT,
    "organizer_bio" TEXT,
    "organizer_experience" TEXT,
    "specialties" TEXT[],
    "certifications" TEXT[],
    "languages" TEXT[],
    "years_of_experience" INTEGER,
    "total_trips_organized" INTEGER NOT NULL DEFAULT 0,
    "organizer_achievements" TEXT[],
    "organizer_unique_url" TEXT,
    "company_name" TEXT,
    "license_number" TEXT,
    "insurance_details" TEXT,
    "payment_qr" TEXT,
    "auto_pay_setup_required" BOOLEAN NOT NULL DEFAULT true,
    "auto_pay_setup_completed" BOOLEAN NOT NULL DEFAULT false,
    "auto_pay_first_login_date" TIMESTAMP(3),
    "auto_pay_setup_completed_at" TIMESTAMP(3),
    "auto_pay_scheduled_date" TIMESTAMP(3),
    "auto_pay_amount" DECIMAL(14,2),
    "auto_pay_customer_id" TEXT,
    "auto_pay_method_id" TEXT,
    "auto_pay_last_payment_date" TIMESTAMP(3),
    "auto_pay_next_payment_date" TIMESTAMP(3),
    "auto_pay_enabled" BOOLEAN NOT NULL DEFAULT false,
    "trust_score_overall" DECIMAL(5,2),
    "trust_document_verified" DECIMAL(5,2),
    "trust_bank_verified" DECIMAL(5,2),
    "trust_experience_years" DECIMAL(5,2),
    "trust_completed_trips" DECIMAL(5,2),
    "trust_user_reviews" DECIMAL(5,2),
    "trust_response_time" DECIMAL(5,2),
    "trust_refund_rate" DECIMAL(5,2),
    "trust_score_last_calculated" TIMESTAMP(3),
    "verification_badge" "verification_badge",
    "routing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "razorpay_route_id" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verification_otp_hash" TEXT,
    "email_verification_expires" TIMESTAMP(3),
    "email_verification_attempts" INTEGER NOT NULL DEFAULT 0,
    "email_verification_last_sent_at" TIMESTAMP(3),
    "phone_verified" BOOLEAN NOT NULL DEFAULT false,
    "phone_verification_otp_hash" TEXT,
    "phone_verification_expires" TIMESTAMP(3),
    "phone_verification_attempts" INTEGER NOT NULL DEFAULT 0,
    "phone_verification_last_sent_at" TIMESTAMP(3),
    "kyc_status" "payout_kyc_status" NOT NULL DEFAULT 'pending',
    "kyc_verified" BOOLEAN NOT NULL DEFAULT false,
    "kyc_submitted_at" TIMESTAMP(3),
    "kyc_approved_at" TIMESTAMP(3),
    "kyc_rejection_reason" TEXT,
    "razorpay_account_id" TEXT,
    "razorpay_stakeholder_id" TEXT,
    "id_verification_status" "id_verification_status" NOT NULL DEFAULT 'not_verified',
    "id_document_type" "id_document_type",
    "id_document_number" TEXT,
    "id_document_front" TEXT,
    "id_document_back" TEXT,
    "id_verified" BOOLEAN NOT NULL DEFAULT false,
    "id_verified_at" TIMESTAMP(3),
    "id_expiry_date" TIMESTAMP(3),
    "id_rejection_reason" TEXT,
    "profile_visibility" "profile_visibility" NOT NULL DEFAULT 'public',
    "show_email" BOOLEAN NOT NULL DEFAULT false,
    "show_phone" BOOLEAN NOT NULL DEFAULT false,
    "show_location" BOOLEAN NOT NULL DEFAULT true,
    "followers_count" INTEGER NOT NULL DEFAULT 0,
    "following_count" INTEGER NOT NULL DEFAULT 0,
    "posts_count" INTEGER NOT NULL DEFAULT 0,
    "organizer_verification_status" "organizer_verification_status",
    "organizer_verification_submitted_at" TIMESTAMP(3),
    "organizer_verification_approved_at" TIMESTAMP(3),
    "organizer_verification_approved_by" TEXT,
    "organizer_verification_rejected_at" TIMESTAMP(3),
    "organizer_verification_rejection_reason" TEXT,
    "organizer_verification_reviewed_by" TEXT,
    "reputation_points" INTEGER NOT NULL DEFAULT 0,
    "reputation_level" INTEGER NOT NULL DEFAULT 1,
    "reputation_level_name" TEXT NOT NULL DEFAULT 'Explorer',
    "reputation_badges" TEXT[],
    "reset_password_token" TEXT,
    "reset_password_expires" TIMESTAMP(3),
    "first_organizer_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_qr_codes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "payment_method" TEXT NOT NULL DEFAULT 'UPI',
    "description" TEXT NOT NULL DEFAULT '',
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "user_qr_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_achievements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_achievements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_verification_documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimetype" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verified" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_unique_url_key" ON "users"("unique_url");

-- CreateIndex
CREATE UNIQUE INDEX "users_organizer_unique_url_key" ON "users"("organizer_unique_url");

-- CreateIndex
CREATE INDEX "users_role_followers_count_idx" ON "users"("role", "followers_count" DESC);

-- CreateIndex
CREATE INDEX "users_location_idx" ON "users"("location");

-- CreateIndex
CREATE INDEX "user_qr_codes_user_id_idx" ON "user_qr_codes"("user_id");

-- CreateIndex
CREATE INDEX "user_achievements_user_id_idx" ON "user_achievements"("user_id");

-- CreateIndex
CREATE INDEX "user_verification_documents_user_id_idx" ON "user_verification_documents"("user_id");

-- AddForeignKey
ALTER TABLE "user_qr_codes" ADD CONSTRAINT "user_qr_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_verification_documents" ADD CONSTRAINT "user_verification_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─────────────────────────────────────────────────────────────────────────────
-- The parts Prisma cannot express.
--
-- `prisma migrate diff` models columns, defaults and indexes. It does not model
-- CHECK constraints or triggers, so everything below is hand-written and
-- survives a later `migrate diff` untouched.
-- ─────────────────────────────────────────────────────────────────────────────

-- Mongoose coerced email and username to lowercase on the way in
-- (`lowercase: true`). Nothing does that any more once Mongoose is gone, so the
-- rule becomes a constraint rather than a silent rewrite. This one is expected
-- to bite during the port: any code path that inserts a raw address now has to
-- lowercase it itself, which is the point.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase"
  CHECK (email = lower(email));

-- match /^[a-z0-9-_]+$/ with minlength 3 and maxlength 30, as one statement.
ALTER TABLE "users" ADD CONSTRAINT "users_username_format"
  CHECK (username IS NULL OR username ~ '^[a-z0-9_-]{3,30}$');

ALTER TABLE "users" ADD CONSTRAINT "users_bio_length"
  CHECK (bio IS NULL OR char_length(bio) <= 500);

ALTER TABLE "users" ADD CONSTRAINT "users_organizer_bio_length"
  CHECK (organizer_bio IS NULL OR char_length(organizer_bio) <= 1000);

ALTER TABLE "users" ADD CONSTRAINT "users_organizer_experience_length"
  CHECK (organizer_experience IS NULL OR char_length(organizer_experience) <= 1000);

-- emergencyContact was optional, but name/relationship/phone were required
-- inside it. Three nullable columns cannot say that on their own; this can.
ALTER TABLE "users" ADD CONSTRAINT "users_emergency_contact_complete"
  CHECK (
    (emergency_contact_name IS NULL AND emergency_contact_relationship IS NULL AND emergency_contact_phone IS NULL)
    OR
    (emergency_contact_name IS NOT NULL AND emergency_contact_relationship IS NOT NULL AND emergency_contact_phone IS NOT NULL)
  );

-- Same shape: idVerification was optional, documentType and documentNumber were
-- required within it.
ALTER TABLE "users" ADD CONSTRAINT "users_id_verification_complete"
  CHECK (
    (id_document_type IS NULL AND id_document_number IS NULL)
    OR
    (id_document_type IS NOT NULL AND id_document_number IS NOT NULL)
  );

-- budgetRange was [Number] with a validator reading "exactly 2 numbers or
-- empty". Two columns make a third impossible; this adds the ordering the
-- validator never checked.
ALTER TABLE "users" ADD CONSTRAINT "users_budget_range_ordered"
  CHECK (budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max);

-- min: 0 and min: 1 from the Mongoose schema.
ALTER TABLE "users" ADD CONSTRAINT "users_counters_non_negative"
  CHECK (
    followers_count >= 0 AND following_count >= 0 AND posts_count >= 0
    AND reputation_points >= 0 AND total_trips_organized >= 0
    AND trips_completed >= 0 AND review_count >= 0
    AND (years_of_experience IS NULL OR years_of_experience >= 0)
  );

ALTER TABLE "users" ADD CONSTRAINT "users_reputation_level_positive"
  CHECK (reputation_level >= 1);

-- min: 0, max: 5 on travelStats.averageRating.
ALTER TABLE "users" ADD CONSTRAINT "users_average_rating_range"
  CHECK (average_rating >= 0 AND average_rating <= 5);

-- admin.service.ts validates the overall score as 0-100 in two places and then
-- throws. The breakdown components each have their own cap in code (20, 20, 10,
-- 5, ...); 0-100 is the bound that is certain for all of them.
ALTER TABLE "users" ADD CONSTRAINT "users_trust_score_range"
  CHECK (
    (trust_score_overall IS NULL OR (trust_score_overall >= 0 AND trust_score_overall <= 100))
    AND (trust_document_verified IS NULL OR (trust_document_verified >= 0 AND trust_document_verified <= 100))
    AND (trust_bank_verified IS NULL OR (trust_bank_verified >= 0 AND trust_bank_verified <= 100))
    AND (trust_experience_years IS NULL OR (trust_experience_years >= 0 AND trust_experience_years <= 100))
    AND (trust_completed_trips IS NULL OR (trust_completed_trips >= 0 AND trust_completed_trips <= 100))
    AND (trust_user_reviews IS NULL OR (trust_user_reviews >= 0 AND trust_user_reviews <= 100))
    AND (trust_response_time IS NULL OR (trust_response_time >= 0 AND trust_response_time <= 100))
    AND (trust_refund_rate IS NULL OR (trust_refund_rate >= 0 AND trust_refund_rate <= 100))
  );

-- Full-text search over name, email and bio.
--
-- The Mongoose schema declared two text indexes: {name, email} and {name, bio}.
-- MongoDB permits exactly one text index per collection, so one of the two has
-- never existed - the second declaration loses. Postgres has no such limit and
-- one GIN index covers all three fields.
CREATE INDEX "users_search_idx" ON "users"
  USING GIN (to_tsvector('english',
    coalesce(name, '') || ' ' || coalesce(email, '') || ' ' || coalesce(bio, '')));

-- ─────────────────────────────────────────────────────────────────────────────
-- Derived counters
--
-- followersCount, followingCount and postsCount were stored numbers the
-- application incremented by hand. Wave 1 kept them because Follow had moved to
-- Postgres while User had not, so the sort could not be answered by counting
-- rows. Both sides are here now, so they get the treatment trips got: the
-- database maintains them and nothing can write one without the other agreeing.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION refresh_user_follow_counts(subject_id text)
RETURNS void AS $$
BEGIN
  UPDATE users SET
    followers_count = (SELECT count(*) FROM follows WHERE following_id = subject_id),
    following_count = (SELECT count(*) FROM follows WHERE follower_id  = subject_id)
  WHERE id = subject_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION follows_maintain_user_counts()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM refresh_user_follow_counts(NEW.follower_id);
    PERFORM refresh_user_follow_counts(NEW.following_id);
  END IF;
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    PERFORM refresh_user_follow_counts(OLD.follower_id);
    PERFORM refresh_user_follow_counts(OLD.following_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER follows_maintain_user_counts
AFTER INSERT OR UPDATE OR DELETE ON follows
FOR EACH ROW EXECUTE FUNCTION follows_maintain_user_counts();

CREATE OR REPLACE FUNCTION refresh_user_post_count(subject_id text)
RETURNS void AS $$
BEGIN
  UPDATE users SET
    posts_count = (SELECT count(*) FROM posts WHERE author_id = subject_id)
  WHERE id = subject_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION posts_maintain_user_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM refresh_user_post_count(NEW.author_id);
  END IF;
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    PERFORM refresh_user_post_count(OLD.author_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER posts_maintain_user_count
AFTER INSERT OR UPDATE OR DELETE ON posts
FOR EACH ROW EXECUTE FUNCTION posts_maintain_user_count();

-- travelStats.reviewCount / averageRating: reviews written ABOUT this user as an
-- organizer, which is what reviewVerification.ts:469 recomputes by hand today.
--
-- Keyed on target_id + review_type = 'organizer'. Note the shape carefully: the
-- equivalent trigger for trips was very nearly keyed on reviews.trip_id, a
-- column nothing ever writes, which would have reinstated the exact zero-ratings
-- bug it was meant to fix.
CREATE OR REPLACE FUNCTION refresh_user_review_stats(subject_id text)
RETURNS void AS $$
BEGIN
  UPDATE users SET
    average_rating = COALESCE((
      SELECT round(avg(rating)::numeric, 2) FROM reviews
      WHERE target_id = subject_id AND review_type = 'organizer'
    ), 0),
    review_count = (
      SELECT count(*) FROM reviews
      WHERE target_id = subject_id AND review_type = 'organizer'
    )
  WHERE id = subject_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reviews_maintain_user_stats()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM refresh_user_review_stats(NEW.target_id);
  END IF;
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    PERFORM refresh_user_review_stats(OLD.target_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_maintain_user_stats
AFTER INSERT OR UPDATE OR DELETE ON reviews
FOR EACH ROW EXECUTE FUNCTION reviews_maintain_user_stats();
