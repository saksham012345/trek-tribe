-- CreateEnum
CREATE TYPE "review_type" AS ENUM ('trip', 'organizer');

-- CreateEnum
CREATE TYPE "review_tag" AS ENUM ('safety', 'value_for_money', 'organization', 'communication', 'accommodation', 'food', 'activities', 'guide_quality', 'group_size', 'timing', 'location', 'equipment');

-- DropIndex
DROP INDEX "posts_tags_idx";

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "reviewer_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "review_type" "review_type" NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(100) NOT NULL,
    "comment" VARCHAR(1000) NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" "review_tag"[] DEFAULT ARRAY[]::"review_tag"[],
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "organizer_response_message" VARCHAR(500),
    "organizer_response_responded_at" TIMESTAMP(3),
    "trip_date" TIMESTAMP(3),
    "user_id" TEXT,
    "trip_id" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "verification_notes" TEXT,
    "is_rejected" BOOLEAN NOT NULL DEFAULT false,
    "rejected_at" TIMESTAMP(3),
    "rejected_by" TEXT,
    "rejection_reason" TEXT,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "flagged_at" TIMESTAMP(3),
    "moderated_at" TIMESTAMP(3),
    "moderated_by" TEXT,
    "moderation_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_helpful_votes" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_helpful_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_flags" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "flagged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_flags_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reviews_target_id_review_type_rating_idx" ON "reviews"("target_id", "review_type", "rating");

-- CreateIndex
CREATE INDEX "reviews_reviewer_id_created_at_idx" ON "reviews"("reviewer_id", "created_at");

-- CreateIndex
CREATE INDEX "reviews_review_type_is_verified_created_at_idx" ON "reviews"("review_type", "is_verified", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_reviewer_id_target_id_review_type_key" ON "reviews"("reviewer_id", "target_id", "review_type");

-- CreateIndex
CREATE INDEX "review_helpful_votes_user_id_idx" ON "review_helpful_votes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_helpful_votes_review_id_user_id_key" ON "review_helpful_votes"("review_id", "user_id");

-- CreateIndex
CREATE INDEX "review_flags_review_id_idx" ON "review_flags"("review_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_flags_review_id_user_id_key" ON "review_flags"("review_id", "user_id");

-- AddForeignKey
ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_flags" ADD CONSTRAINT "review_flags_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- rating was `min: 1, max: 5` in Mongoose - a model-level validation, so a write
-- that bypassed the model could store 0 or 11. It is a constraint here.
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_1_to_5" CHECK (rating BETWEEN 1 AND 5);

-- The Mongoose text index covered title, comment and tags. Same split as posts:
-- the regconfig is cast so the expression is IMMUTABLE, and tags stay out of the
-- tsvector because array_to_string is STABLE. Tags get their own GIN index,
-- which is what an enum-array filter actually uses.
CREATE INDEX "reviews_search_idx" ON "reviews"
  USING GIN (to_tsvector('english'::regconfig, "title" || ' ' || "comment"));

CREATE INDEX "reviews_tags_idx" ON "reviews" USING GIN ("tags");

-- Sorting "best reviews" was an index on rating + helpfulVotes. helpfulVotes is
-- no longer a column - it is a count of review_helpful_votes rows - so the
-- composite index cannot exist. This covers the rating half; the vote half is
-- served by review_helpful_votes(review_id) from the unique constraint.
CREATE INDEX "reviews_rating_idx" ON "reviews" ("rating" DESC);
