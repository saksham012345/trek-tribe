-- CreateEnum
CREATE TYPE "expense_category" AS ENUM ('transport', 'stay', 'food', 'guide', 'permits', 'marketing', 'platform_fee', 'miscellaneous');

-- CreateEnum
CREATE TYPE "ledger_entry_type" AS ENUM ('credit', 'debit');

-- CreateEnum
CREATE TYPE "ledger_source" AS ENUM ('order', 'transfer', 'refund', 'adjustment');

-- CreateEnum
CREATE TYPE "marketplace_order_status" AS ENUM ('created', 'paid', 'failed', 'refunded', 'partial_refund');

-- CreateEnum
CREATE TYPE "split_status" AS ENUM ('pending', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "order_refund_status" AS ENUM ('none', 'requested', 'processed', 'partial');

-- CreateEnum
CREATE TYPE "transfer_status" AS ENUM ('pending', 'initiated', 'processed', 'failed', 'reversed');

-- CreateEnum
CREATE TYPE "refund_status" AS ENUM ('pending', 'processed', 'failed');

-- CreateEnum
CREATE TYPE "payout_onboarding_status" AS ENUM ('pending', 'connected', 'activated', 'rejected');

-- CreateEnum
CREATE TYPE "payout_kyc_status" AS ENUM ('pending', 'submitted', 'under_review', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "subscription_plan" AS ENUM ('trial', 'free-trial', 'starter', 'basic', 'pro', 'professional', 'premium', 'enterprise');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('pending_payment', 'active', 'expired', 'cancelled', 'trial');

-- CreateEnum
CREATE TYPE "payment_record_status" AS ENUM ('pending', 'completed', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "trip_usage_status" AS ENUM ('active', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "subscription_notification_type" AS ENUM ('trial_ending', 'trial_ended', 'payment_due', 'payment_failed', 'trips_exhausted', 'subscription_renewed');

-- CreateEnum
CREATE TYPE "crm_plan_type" AS ENUM ('trip_package_5', 'trip_package_10', 'trip_package_20', 'trip_package_50', 'crm_bundle', 'trial');

-- CreateEnum
CREATE TYPE "crm_subscription_status" AS ENUM ('active', 'expired', 'cancelled', 'pending_payment');

-- CreateEnum
CREATE TYPE "crm_package_type" AS ENUM ('5_trips', '10_trips', '20_trips', '50_trips');

-- CreateEnum
CREATE TYPE "crm_payment_attempt_status" AS ENUM ('attempted', 'success', 'failed');

-- AlterTable
ALTER TABLE "support_tickets" ALTER COLUMN "ticket_id" SET DEFAULT ('TT-'::text || to_char(now(), 'YYMMDD'::text) || '-'::text || lpad((nextval('support_ticket_number_seq'::regclass))::text, 4, '0'::text));

-- AlterTable
ALTER TABLE "tickets" ALTER COLUMN "ticket_number" SET DEFAULT ('TKT-'::text || to_char(now(), 'YYMMDD'::text) || '-'::text || lpad((nextval('ticket_number_seq'::regclass))::text, 4, '0'::text));

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "category" "expense_category" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" VARCHAR(500),
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_ledger" (
    "id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "type" "ledger_entry_type" NOT NULL,
    "source" "ledger_source" NOT NULL,
    "reference_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_orders" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "payment_id" TEXT,
    "user_id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "trip_id" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "notes" JSONB,
    "status" "marketplace_order_status" NOT NULL DEFAULT 'created',
    "commission_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "organizer_payout_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "razorpay_fee_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "split_status" "split_status" NOT NULL DEFAULT 'pending',
    "refund_status" "order_refund_status" NOT NULL DEFAULT 'none',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_transfers" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "transfer_id" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "commission_amount" DECIMAL(14,2) NOT NULL,
    "razorpay_fee_amount" DECIMAL(14,2) NOT NULL,
    "payout_amount" DECIMAL(14,2) NOT NULL,
    "status" "transfer_status" NOT NULL DEFAULT 'pending',
    "hold_until" TIMESTAMP(3),
    "processed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_refunds" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "payment_id" TEXT NOT NULL,
    "refund_id" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "reason" TEXT,
    "reversed_transfer" BOOLEAN NOT NULL DEFAULT false,
    "status" "refund_status" NOT NULL DEFAULT 'pending',
    "created_by" TEXT,
    "processed_at" TIMESTAMP(3),
    "failure_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizer_payout_configs" (
    "id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "razorpay_account_id" TEXT,
    "onboarding_status" "payout_onboarding_status" NOT NULL DEFAULT 'pending',
    "account_number_encrypted" TEXT NOT NULL,
    "ifsc_code" VARCHAR(11) NOT NULL,
    "account_holder_name" TEXT NOT NULL,
    "bank_name" TEXT,
    "kyc_status" "payout_kyc_status" NOT NULL DEFAULT 'pending',
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizer_payout_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizer_subscriptions" (
    "id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "plan" "subscription_plan" NOT NULL DEFAULT 'free-trial',
    "plan_type" TEXT,
    "status" "subscription_status" NOT NULL DEFAULT 'pending_payment',
    "is_trial_active" BOOLEAN NOT NULL DEFAULT false,
    "crm_access" BOOLEAN NOT NULL DEFAULT false,
    "crm_bundle_has_access" BOOLEAN NOT NULL DEFAULT false,
    "crm_bundle_price" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "crm_bundle_features" TEXT[],
    "subscription_start_date" TIMESTAMP(3),
    "subscription_end_date" TIMESTAMP(3),
    "trial_start_date" TIMESTAMP(3),
    "trial_end_date" TIMESTAMP(3),
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "trips_per_cycle" INTEGER NOT NULL DEFAULT 5,
    "trips_used" INTEGER NOT NULL DEFAULT 0,
    "price_per_cycle" DECIMAL(14,2) NOT NULL DEFAULT 1499,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "last_payment_date" TIMESTAMP(3),
    "next_payment_due" TIMESTAMP(3),
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "payment_method_id" TEXT,
    "payment_method_valid" BOOLEAN,
    "notes" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizer_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_payments" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "payment_method" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "payment_record_status" NOT NULL DEFAULT 'pending',
    "receipt_url" TEXT,

    CONSTRAINT "subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_trip_usage" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "trip_id" TEXT NOT NULL,
    "trip_title" TEXT NOT NULL,
    "status" "trip_usage_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_trip_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_notifications" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "type" "subscription_notification_type" NOT NULL,
    "message" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_subscriptions" (
    "id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "plan_type" "crm_plan_type" NOT NULL,
    "status" "crm_subscription_status" NOT NULL DEFAULT 'active',
    "package_type" "crm_package_type" NOT NULL DEFAULT '5_trips',
    "total_trips" INTEGER NOT NULL DEFAULT 5,
    "used_trips" INTEGER NOT NULL DEFAULT 0,
    "price_per_package" DECIMAL(14,2) NOT NULL DEFAULT 1499,
    "crm_bundle_has_access" BOOLEAN NOT NULL DEFAULT false,
    "crm_bundle_price" DECIMAL(14,2) NOT NULL DEFAULT 2100,
    "crm_bundle_features" TEXT[],
    "trial_is_active" BOOLEAN NOT NULL DEFAULT false,
    "trial_start_date" TIMESTAMP(3),
    "trial_end_date" TIMESTAMP(3),
    "trial_months_remaining" INTEGER NOT NULL DEFAULT 2,
    "trial_ending_in_7_days" BOOLEAN NOT NULL DEFAULT false,
    "trial_ending_in_1_day" BOOLEAN NOT NULL DEFAULT false,
    "trial_expired" BOOLEAN NOT NULL DEFAULT false,
    "payment_reminder" BOOLEAN NOT NULL DEFAULT false,
    "last_reminder_sent_at" TIMESTAMP(3),
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMP(3),
    "expiry_reminder_sent" BOOLEAN NOT NULL DEFAULT false,
    "auto_renew" BOOLEAN NOT NULL DEFAULT false,
    "cancelled_at" TIMESTAMP(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crm_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_subscription_payments" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "razorpay_signature" TEXT,
    "transaction_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "payment_method" TEXT NOT NULL,
    "status" "payment_record_status" NOT NULL DEFAULT 'pending',
    "paid_at" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "crm_subscription_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_payment_attempts" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "attempt_id" TEXT NOT NULL,
    "razorpay_order_id" TEXT,
    "razorpay_payment_id" TEXT,
    "amount" DECIMAL(14,2),
    "status" "crm_payment_attempt_status" NOT NULL DEFAULT 'attempted',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_payment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_billing_entries" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "invoice_url" TEXT,

    CONSTRAINT "crm_billing_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_trip_id_category_idx" ON "expenses"("trip_id", "category");

-- CreateIndex
CREATE INDEX "expenses_organizer_id_date_idx" ON "expenses"("organizer_id", "date");

-- CreateIndex
CREATE INDEX "payout_ledger_organizer_id_created_at_idx" ON "payout_ledger"("organizer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "payout_ledger_source_reference_id_type_key" ON "payout_ledger"("source", "reference_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_orders_order_id_key" ON "marketplace_orders"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_orders_payment_id_key" ON "marketplace_orders"("payment_id");

-- CreateIndex
CREATE INDEX "marketplace_orders_organizer_id_created_at_idx" ON "marketplace_orders"("organizer_id", "created_at");

-- CreateIndex
CREATE INDEX "marketplace_orders_user_id_created_at_idx" ON "marketplace_orders"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_transfers_transfer_id_key" ON "marketplace_transfers"("transfer_id");

-- CreateIndex
CREATE INDEX "marketplace_transfers_order_id_status_idx" ON "marketplace_transfers"("order_id", "status");

-- CreateIndex
CREATE INDEX "marketplace_transfers_organizer_id_created_at_idx" ON "marketplace_transfers"("organizer_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "marketplace_refunds_refund_id_key" ON "marketplace_refunds"("refund_id");

-- CreateIndex
CREATE INDEX "marketplace_refunds_order_id_created_at_idx" ON "marketplace_refunds"("order_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "organizer_payout_configs_organizer_id_key" ON "organizer_payout_configs"("organizer_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizer_subscriptions_organizer_id_key" ON "organizer_subscriptions"("organizer_id");

-- CreateIndex
CREATE INDEX "organizer_subscriptions_status_idx" ON "organizer_subscriptions"("status");

-- CreateIndex
CREATE INDEX "organizer_subscriptions_status_next_payment_due_idx" ON "organizer_subscriptions"("status", "next_payment_due");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_payments_transaction_id_key" ON "subscription_payments"("transaction_id");

-- CreateIndex
CREATE INDEX "subscription_payments_subscription_id_payment_date_idx" ON "subscription_payments"("subscription_id", "payment_date");

-- CreateIndex
CREATE INDEX "subscription_payments_subscription_id_status_idx" ON "subscription_payments"("subscription_id", "status");

-- CreateIndex
CREATE INDEX "subscription_trip_usage_subscription_id_created_at_idx" ON "subscription_trip_usage"("subscription_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_trip_usage_subscription_id_trip_id_key" ON "subscription_trip_usage"("subscription_id", "trip_id");

-- CreateIndex
CREATE INDEX "subscription_notifications_subscription_id_sent_at_idx" ON "subscription_notifications"("subscription_id", "sent_at");

-- CreateIndex
CREATE INDEX "crm_subscriptions_organizer_id_created_at_idx" ON "crm_subscriptions"("organizer_id", "created_at");

-- CreateIndex
CREATE INDEX "crm_subscriptions_status_idx" ON "crm_subscriptions"("status");

-- CreateIndex
CREATE INDEX "crm_subscriptions_end_date_idx" ON "crm_subscriptions"("end_date");

-- CreateIndex
CREATE UNIQUE INDEX "crm_subscription_payments_transaction_id_key" ON "crm_subscription_payments"("transaction_id");

-- CreateIndex
CREATE INDEX "crm_subscription_payments_subscription_id_status_idx" ON "crm_subscription_payments"("subscription_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "crm_payment_attempts_attempt_id_key" ON "crm_payment_attempts"("attempt_id");

-- CreateIndex
CREATE INDEX "crm_payment_attempts_subscription_id_created_at_idx" ON "crm_payment_attempts"("subscription_id", "created_at");

-- CreateIndex
CREATE INDEX "crm_billing_entries_subscription_id_date_idx" ON "crm_billing_entries"("subscription_id", "date");

-- AddForeignKey
ALTER TABLE "marketplace_transfers" ADD CONSTRAINT "marketplace_transfers_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketplace_refunds" ADD CONSTRAINT "marketplace_refunds_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "marketplace_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "organizer_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_trip_usage" ADD CONSTRAINT "subscription_trip_usage_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "organizer_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_notifications" ADD CONSTRAINT "subscription_notifications_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "organizer_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_subscription_payments" ADD CONSTRAINT "crm_subscription_payments_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "crm_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_payment_attempts" ADD CONSTRAINT "crm_payment_attempts_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "crm_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_billing_entries" ADD CONSTRAINT "crm_billing_entries_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "crm_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Constraints Prisma does not model ────────────────────────────────────────
--
-- Prisma models columns, defaults, uniques and indexes; it does not model CHECK.
-- These survive `prisma migrate diff` for that reason, which is the only reason
-- hand-written SQL is safe to put in these files at all.
--
-- Money is the domain where "the application checks it" is least worth relying
-- on: the paths below are reached by Razorpay webhooks, retries and admin tools,
-- not only by the one route that does the validating.

-- An expense is an amount spent. Zero is allowed (a recorded line item that
-- turned out to cost nothing); negative is not - that is a refund, and there is
-- no refund concept here.
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_nonneg" CHECK ("amount" >= 0);

-- Direction lives in `type` (credit or debit), so the amount is a magnitude.
-- A negative debit is a credit written the wrong way round, and a zero entry is
-- a row that says nothing.
ALTER TABLE "payout_ledger" ADD CONSTRAINT "payout_ledger_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_parts_nonneg"
  CHECK ("commission_amount" >= 0 AND "organizer_payout_amount" >= 0 AND "razorpay_fee_amount" >= 0);
ALTER TABLE "marketplace_orders" ADD CONSTRAINT "marketplace_orders_commission_rate_range"
  CHECK ("commission_rate" >= 0 AND "commission_rate" <= 100);

-- The invariant of a split: the parts are the whole.
--
--   payoutAmount = amount - commissionAmount - razorpayFeeAmount
--
-- is how calculateSplit() builds them, so this is true by construction today and
-- the CHECK is what keeps it true when someone edits one of the three.
ALTER TABLE "marketplace_transfers" ADD CONSTRAINT "marketplace_transfers_split_adds_up"
  CHECK ("amount" = "commission_amount" + "razorpay_fee_amount" + "payout_amount");
ALTER TABLE "marketplace_transfers" ADD CONSTRAINT "marketplace_transfers_parts_nonneg"
  CHECK ("amount" > 0 AND "commission_amount" >= 0 AND "razorpay_fee_amount" >= 0 AND "payout_amount" >= 0);

ALTER TABLE "marketplace_refunds" ADD CONSTRAINT "marketplace_refunds_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "organizer_payout_configs" ADD CONSTRAINT "organizer_payout_configs_commission_rate_range"
  CHECK ("commission_rate" >= 0 AND "commission_rate" <= 100);
-- IFSC is fixed by the RBI: four letters, a zero, then six alphanumerics. A code
-- that does not match cannot identify a branch, so a payout configured with one
-- is a payout that will fail at the bank rather than here.
ALTER TABLE "organizer_payout_configs" ADD CONSTRAINT "organizer_payout_configs_ifsc_format"
  CHECK ("ifsc_code" ~ '^[A-Z]{4}0[A-Z0-9]{6}$');

-- This is the one that makes useTripSlot() correct. The check is not decoration:
-- the port increments trips_used conditionally and relies on the database to
-- refuse the increment that would exceed the cycle.
ALTER TABLE "organizer_subscriptions" ADD CONSTRAINT "organizer_subscriptions_trips_within_cycle"
  CHECK ("trips_used" >= 0 AND "trips_per_cycle" >= 0 AND "trips_used" <= "trips_per_cycle");
ALTER TABLE "organizer_subscriptions" ADD CONSTRAINT "organizer_subscriptions_price_nonneg"
  CHECK ("price_per_cycle" >= 0 AND "crm_bundle_price" >= 0);

ALTER TABLE "subscription_payments" ADD CONSTRAINT "subscription_payments_amount_nonneg" CHECK ("amount" >= 0);

ALTER TABLE "crm_subscriptions" ADD CONSTRAINT "crm_subscriptions_trips_within_package"
  CHECK ("used_trips" >= 0 AND "total_trips" >= 0 AND "used_trips" <= "total_trips");
ALTER TABLE "crm_subscriptions" ADD CONSTRAINT "crm_subscriptions_price_nonneg"
  CHECK ("price_per_package" >= 0 AND "crm_bundle_price" >= 0);
ALTER TABLE "crm_subscriptions" ADD CONSTRAINT "crm_subscriptions_trial_months_nonneg"
  CHECK ("trial_months_remaining" >= 0);

ALTER TABLE "crm_subscription_payments" ADD CONSTRAINT "crm_subscription_payments_amount_nonneg" CHECK ("amount" >= 0);
ALTER TABLE "crm_payment_attempts" ADD CONSTRAINT "crm_payment_attempts_amount_nonneg" CHECK ("amount" IS NULL OR "amount" >= 0);
ALTER TABLE "crm_billing_entries" ADD CONSTRAINT "crm_billing_entries_amount_nonneg" CHECK ("amount" >= 0);
