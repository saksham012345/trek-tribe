-- AlterTable
ALTER TABLE "support_tickets" ADD COLUMN     "customer_feedback" VARCHAR(500),
ADD COLUMN     "customer_satisfaction_rating" INTEGER;


-- Mongoose had min 1 / max 5 on the rating.
ALTER TABLE "support_tickets"
  ADD CONSTRAINT "support_tickets_satisfaction_1_to_5"
  CHECK ("customer_satisfaction_rating" IS NULL
     OR "customer_satisfaction_rating" BETWEEN 1 AND 5);
