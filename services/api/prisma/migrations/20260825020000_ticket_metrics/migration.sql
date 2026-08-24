-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "resolution_time" INTEGER,
ADD COLUMN     "response_time" INTEGER,
ADD COLUMN     "satisfaction_rating" INTEGER,
ALTER COLUMN "ticket_number" DROP DEFAULT;


-- satisfactionRating was min 1 / max 5 in Mongoose.
ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_satisfaction_1_to_5"
  CHECK ("satisfaction_rating" IS NULL OR "satisfaction_rating" BETWEEN 1 AND 5);

-- Minutes cannot be negative.
ALTER TABLE "tickets"
  ADD CONSTRAINT "tickets_times_non_negative"
  CHECK (("response_time" IS NULL OR "response_time" >= 0)
     AND ("resolution_time" IS NULL OR "resolution_time" >= 0));
