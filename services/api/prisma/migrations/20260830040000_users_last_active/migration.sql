-- Wave 9 flattened User onto Postgres but did not carry lastActive.
--
-- It is written on every login, read by the admin CSV export in three places,
-- and is the basis of the "users active in the last 30 days" figure. Without
-- the column that figure is zero and the export column is blank, and neither
-- of those announces itself — it took a Prisma validation error on login to
-- surface it, because Mongoose had been accepting the write and Postgres would
-- not.

ALTER TABLE "users" ADD COLUMN "last_active" TIMESTAMP(3);

-- Existing rows get their creation time rather than NULL. A user who has never
-- been seen since this column existed is not "active today", but they are also
-- not unknown — created_at is the last moment we can honestly claim.
UPDATE "users" SET "last_active" = "created_at" WHERE "last_active" IS NULL;

CREATE INDEX "users_last_active_idx" ON "users"("last_active");
