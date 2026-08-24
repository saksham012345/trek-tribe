-- DropIndex
DROP INDEX "ai_conversations_last_interaction_at_idx";

-- DropIndex
DROP INDEX "ai_conversations_user_id_idx";

-- AlterTable
ALTER TABLE "ai_conversations" DROP COLUMN "escalation",
ADD COLUMN     "ai_confidence_avg" DOUBLE PRECISION,
ADD COLUMN     "assigned_agent_id" TEXT,
ADD COLUMN     "avg_response_time" DOUBLE PRECISION,
ADD COLUMN     "escalated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "escalated_at" TIMESTAMP(3),
ADD COLUMN     "escalation_reason" TEXT,
ADD COLUMN     "user_satisfaction" INTEGER;

-- CreateIndex
CREATE INDEX "ai_conversations_user_id_last_interaction_at_idx" ON "ai_conversations"("user_id", "last_interaction_at");

-- CreateIndex
CREATE INDEX "ai_conversations_escalated_assigned_agent_id_idx" ON "ai_conversations"("escalated", "assigned_agent_id");


-- Mongoose bounded these: satisfaction 1..5, confidence 0..1.
ALTER TABLE "ai_conversations"
  ADD CONSTRAINT "ai_conversations_satisfaction_1_to_5"
  CHECK ("user_satisfaction" IS NULL OR "user_satisfaction" BETWEEN 1 AND 5);

ALTER TABLE "ai_conversations"
  ADD CONSTRAINT "ai_conversations_confidence_0_to_1"
  CHECK ("ai_confidence_avg" IS NULL OR ("ai_confidence_avg" >= 0 AND "ai_confidence_avg" <= 1));
