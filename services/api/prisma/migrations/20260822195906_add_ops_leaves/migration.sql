-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'VERIFY', 'PAYMENT', 'SUSPEND', 'APPROVE', 'REJECT', 'payment_captured', 'payment_failed', 'subscription_activated', 'subscription_charged', 'subscription_cancelled', 'subscription_paused', 'order_paid');

-- CreateEnum
CREATE TYPE "audit_resource" AS ENUM ('Trip', 'User', 'Payment', 'Subscription', 'Ticket', 'Lead', 'Review', 'Booking', 'Auth', 'MarketplaceOrder', 'MarketplaceTransfer', 'MarketplaceRefund');

-- CreateEnum
CREATE TYPE "audit_status" AS ENUM ('SUCCESS', 'FAILURE', 'PENDING');

-- CreateEnum
CREATE TYPE "notification_type" AS ENUM ('ticket', 'chat', 'verification', 'payment', 'booking', 'lead', 'system', 'reminder');

-- CreateEnum
CREATE TYPE "notification_priority" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "notification_action_type" AS ENUM ('view_ticket', 'view_trip', 'make_payment', 'verify_trip', 'respond_chat', 'view_lead');

-- CreateEnum
CREATE TYPE "notification_related_type" AS ENUM ('ticket', 'trip', 'booking', 'payment', 'lead', 'chat');

-- CreateEnum
CREATE TYPE "retry_job_status" AS ENUM ('pending', 'in_progress', 'failed', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "site_overlay_style" AS ENUM ('light', 'dark');

-- DropIndex
DROP INDEX "reviews_rating_idx";

-- DropIndex
DROP INDEX "reviews_tags_idx";

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_email" TEXT,
    "action" "audit_action" NOT NULL,
    "resource" "audit_resource" NOT NULL,
    "resource_id" TEXT,
    "changes_before" JSONB,
    "changes_after" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "audit_status" NOT NULL DEFAULT 'SUCCESS',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "notification_type" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" "notification_priority" NOT NULL DEFAULT 'medium',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "action_url" TEXT,
    "action_type" "notification_action_type",
    "related_to_type" "notification_related_type",
    "related_to_id" TEXT,
    "metadata" JSONB,
    "email_sent" BOOLEAN NOT NULL DEFAULT false,
    "email_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retry_jobs" (
    "id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "payload" JSONB,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retries" INTEGER NOT NULL DEFAULT 5,
    "last_attempt" TIMESTAMP(3),
    "next_retry_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "retry_job_status" NOT NULL DEFAULT 'pending',
    "last_error" TEXT,
    "last_result" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retry_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "processed_at" TIMESTAMP(3),
    "raw_payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'global',
    "home_hero_images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "home_overlay_style" "site_overlay_style" NOT NULL DEFAULT 'light',
    "home_font_family" TEXT NOT NULL DEFAULT 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    "home_discover_columns_desktop" INTEGER NOT NULL DEFAULT 3,
    "home_discover_columns_mobile" INTEGER NOT NULL DEFAULT 2,
    "contact_support_email" TEXT NOT NULL DEFAULT 'support@trektribe.com',
    "contact_otp_from_email" TEXT NOT NULL DEFAULT 'noreply@trektribe.com',
    "contact_booking_from_email" TEXT NOT NULL DEFAULT 'bookings@trektribe.com',
    "notifications_email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "notifications_sms_enabled" BOOLEAN NOT NULL DEFAULT false,
    "notifications_send_follower_alerts" BOOLEAN NOT NULL DEFAULT true,
    "notifications_trip_reminder_hours" INTEGER NOT NULL DEFAULT 24,
    "integrations_payment_provider" TEXT NOT NULL DEFAULT 'razorpay',
    "integrations_email_provider" TEXT NOT NULL DEFAULT 'sendgrid',
    "integrations_sms_provider" TEXT NOT NULL DEFAULT 'twilio',
    "integrations_twilio_from_number" TEXT,
    "updated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_user_id_timestamp_idx" ON "audit_logs"("user_id", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_resource_action_timestamp_idx" ON "audit_logs"("resource", "action", "timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_is_read_idx" ON "notifications"("is_read");

-- CreateIndex
CREATE INDEX "notifications_type_idx" ON "notifications"("type");

-- CreateIndex
CREATE INDEX "retry_jobs_reference_id_idx" ON "retry_jobs"("reference_id");

-- CreateIndex
CREATE INDEX "retry_jobs_next_retry_at_status_idx" ON "retry_jobs"("next_retry_at", "status");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_event_id_key" ON "webhook_events"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "site_settings_key_key" ON "site_settings"("key");

-- The Mongoose SiteSettings capped the discover column counts (desktop 1-6,
-- mobile 1-4). Those were model validations; here they hold regardless of who
-- writes. A settings row with 0 columns would render an empty grid.
ALTER TABLE "site_settings"
  ADD CONSTRAINT "site_settings_desktop_columns_1_to_6"
  CHECK ("home_discover_columns_desktop" BETWEEN 1 AND 6);

ALTER TABLE "site_settings"
  ADD CONSTRAINT "site_settings_mobile_columns_1_to_4"
  CHECK ("home_discover_columns_mobile" BETWEEN 1 AND 4);

-- A retry job that has already used up its allowance is a contradiction, and
-- the worker reads maxRetries to decide whether to stop.
ALTER TABLE "retry_jobs"
  ADD CONSTRAINT "retry_jobs_counts_non_negative"
  CHECK ("retry_count" >= 0 AND "max_retries" >= 0);
