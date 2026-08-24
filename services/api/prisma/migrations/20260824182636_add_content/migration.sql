-- CreateEnum
CREATE TYPE "blog_status" AS ENUM ('draft', 'published');

-- CreateEnum
CREATE TYPE "group_category" AS ENUM ('trekking', 'camping', 'wildlife', 'adventure', 'photography', 'cycling', 'other');

-- CreateEnum
CREATE TYPE "group_role" AS ENUM ('member', 'admin');

-- CreateEnum
CREATE TYPE "event_type" AS ENUM ('trip', 'meetup', 'workshop', 'webinar', 'other');

-- CreateEnum
CREATE TYPE "event_status" AS ENUM ('upcoming', 'ongoing', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "event_participation" AS ENUM ('attendee', 'invitee');

-- CreateEnum
CREATE TYPE "knowledge_type" AS ENUM ('faq', 'guide', 'policy', 'trip', 'general');

-- CreateTable
CREATE TABLE "blog_posts" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "slug" TEXT NOT NULL,
    "excerpt" VARCHAR(320) NOT NULL,
    "content" TEXT NOT NULL,
    "cover_image" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "blog_status" NOT NULL DEFAULT 'draft',
    "published_at" TIMESTAMP(3),
    "author_id" TEXT NOT NULL,
    "read_time_minutes" INTEGER NOT NULL DEFAULT 4,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(1000) NOT NULL,
    "category" "group_category" NOT NULL,
    "cover_image" TEXT,
    "creator_id" TEXT NOT NULL,
    "is_public" BOOLEAN NOT NULL DEFAULT true,
    "tags" VARCHAR(30)[] DEFAULT ARRAY[]::VARCHAR(30)[],
    "rules" VARCHAR(2000),
    "location" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" "group_role" NOT NULL DEFAULT 'member',
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "event_type" "event_type" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "is_virtual" BOOLEAN NOT NULL DEFAULT false,
    "virtual_link" TEXT,
    "organizer_id" TEXT NOT NULL,
    "group_id" TEXT,
    "cover_image" TEXT,
    "capacity" INTEGER,
    "status" "event_status" NOT NULL DEFAULT 'upcoming',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "price" DECIMAL(65,30),
    "is_paid" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_participants" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "event_participation" NOT NULL DEFAULT 'attendee',
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_base" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" VARCHAR(10000) NOT NULL,
    "summary" VARCHAR(500),
    "type" "knowledge_type" NOT NULL,
    "category" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "context" JSONB NOT NULL DEFAULT '{}',
    "source_url" TEXT,
    "relevance_score" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "query_count" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_base_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");

-- CreateIndex
CREATE INDEX "blog_posts_status_idx" ON "blog_posts"("status");

-- CreateIndex
CREATE INDEX "blog_posts_published_at_idx" ON "blog_posts"("published_at");

-- CreateIndex
CREATE INDEX "blog_posts_author_id_idx" ON "blog_posts"("author_id");

-- CreateIndex
CREATE INDEX "groups_creator_id_idx" ON "groups"("creator_id");

-- CreateIndex
CREATE INDEX "groups_is_public_idx" ON "groups"("is_public");

-- CreateIndex
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_members_group_id_user_id_key" ON "group_members"("group_id", "user_id");

-- CreateIndex
CREATE INDEX "events_organizer_id_idx" ON "events"("organizer_id");

-- CreateIndex
CREATE INDEX "events_group_id_idx" ON "events"("group_id");

-- CreateIndex
CREATE INDEX "events_status_idx" ON "events"("status");

-- CreateIndex
CREATE INDEX "events_start_date_idx" ON "events"("start_date");

-- CreateIndex
CREATE INDEX "event_participants_user_id_idx" ON "event_participants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_participants_event_id_user_id_key" ON "event_participants"("event_id", "user_id");

-- CreateIndex
CREATE INDEX "knowledge_base_type_is_active_idx" ON "knowledge_base"("type", "is_active");

-- CreateIndex
CREATE INDEX "knowledge_base_category_is_active_idx" ON "knowledge_base"("category", "is_active");

-- AddForeignKey
ALTER TABLE "group_members" ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- readTimeMinutes was min 1 / max 60 in Mongoose - a model validation, so a
-- post written another way could claim a zero-minute read.
ALTER TABLE "blog_posts"
  ADD CONSTRAINT "blog_posts_read_time_1_to_60" CHECK ("read_time_minutes" BETWEEN 1 AND 60);

-- relevanceScore was 0..5 and queryCount could not be negative.
ALTER TABLE "knowledge_base"
  ADD CONSTRAINT "knowledge_base_relevance_0_to_5" CHECK ("relevance_score" BETWEEN 0 AND 5);

ALTER TABLE "knowledge_base"
  ADD CONSTRAINT "knowledge_base_query_count_non_negative" CHECK ("query_count" >= 0);

-- An event that ends before it starts is not a schedule, it is a typo. Mongoose
-- never checked this at all.
ALTER TABLE "events"
  ADD CONSTRAINT "events_end_after_start" CHECK ("end_date" >= "start_date");

ALTER TABLE "events"
  ADD CONSTRAINT "events_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0);

ALTER TABLE "events"
  ADD CONSTRAINT "events_price_non_negative" CHECK ("price" IS NULL OR "price" >= 0);

-- The same text indexes Mongoose declared, spelled out. Same two rules as posts
-- and reviews: the regconfig is cast so the expression is IMMUTABLE, and tags
-- get their own GIN index because array_to_string is STABLE.
CREATE INDEX "blog_posts_search_idx" ON "blog_posts"
  USING GIN (to_tsvector('english'::regconfig, "title" || ' ' || "excerpt" || ' ' || "content"));
CREATE INDEX "blog_posts_tags_idx" ON "blog_posts" USING GIN ("tags");

CREATE INDEX "groups_search_idx" ON "groups"
  USING GIN (to_tsvector('english'::regconfig, "name" || ' ' || "description"));
CREATE INDEX "groups_tags_idx" ON "groups" USING GIN ("tags");

CREATE INDEX "events_search_idx" ON "events"
  USING GIN (to_tsvector('english'::regconfig, "title" || ' ' || "description"));
CREATE INDEX "events_tags_idx" ON "events" USING GIN ("tags");

CREATE INDEX "knowledge_base_tags_idx" ON "knowledge_base" USING GIN ("tags");
