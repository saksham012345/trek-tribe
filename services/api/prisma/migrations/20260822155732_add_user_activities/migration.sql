-- CreateEnum
CREATE TYPE "user_activity_actor_type" AS ENUM ('user', 'organizer');

-- CreateEnum
CREATE TYPE "user_activity_type" AS ENUM ('trip_view', 'trip_created', 'booking_made', 'chat_initiated', 'ticket_created', 'payment_made', 'profile_updated', 'document_uploaded', 'login', 'logout');

-- CreateTable
CREATE TABLE "user_activities" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_type" "user_activity_actor_type" NOT NULL,
    "activity_type" "user_activity_type" NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_activities_user_id_created_at_idx" ON "user_activities"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "user_activities_activity_type_idx" ON "user_activities"("activity_type");

-- CreateIndex
CREATE INDEX "user_activities_created_at_idx" ON "user_activities"("created_at");
