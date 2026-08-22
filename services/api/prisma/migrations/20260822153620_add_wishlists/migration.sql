-- CreateEnum
CREATE TYPE "wishlist_priority" AS ENUM ('low', 'medium', 'high');

-- CreateTable
CREATE TABLE "wishlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "notes" TEXT,
    "priority" "wishlist_priority" NOT NULL DEFAULT 'medium',
    "tags" VARCHAR(50)[] DEFAULT ARRAY[]::VARCHAR(50)[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wishlists_user_id_idx" ON "wishlists"("user_id");

-- CreateIndex
CREATE INDEX "wishlists_trip_id_idx" ON "wishlists"("trip_id");

-- CreateIndex
CREATE INDEX "wishlists_user_id_priority_created_at_idx" ON "wishlists"("user_id", "priority", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_user_id_trip_id_key" ON "wishlists"("user_id", "trip_id");

-- The Mongoose schema capped notes at 500 characters. That was a Mongoose
-- validation, so nothing enforced it for a writer bypassing the model. It is a
-- constraint here. Hand-written: Prisma's schema language has no CHECK, so it
-- must be carried forward if this migration is ever regenerated.
-- The 50-char cap per tag is expressed as VARCHAR(50)[] in the schema instead,
-- because Postgres rejects subqueries inside a CHECK.
ALTER TABLE "wishlists"
  ADD CONSTRAINT "wishlists_notes_max_500" CHECK (notes IS NULL OR length(notes) <= 500);
