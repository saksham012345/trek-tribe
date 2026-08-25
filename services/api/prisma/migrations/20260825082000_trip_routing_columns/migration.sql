-- CreateEnum
CREATE TYPE "trip_routing_status" AS ENUM ('pending_onboarding', 'active', 'main_account_fallback', 'main_account', 'error');

-- AlterTable
ALTER TABLE "support_tickets" ALTER COLUMN "ticket_id" SET DEFAULT ('TT-'::text || to_char(now(), 'YYMMDD'::text) || '-'::text || lpad((nextval('support_ticket_number_seq'::regclass))::text, 4, '0'::text));

-- AlterTable
ALTER TABLE "tickets" ALTER COLUMN "ticket_number" SET DEFAULT ('TKT-'::text || to_char(now(), 'YYMMDD'::text) || '-'::text || lpad((nextval('ticket_number_seq'::regclass))::text, 4, '0'::text));

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "custom_request_id" TEXT,
ADD COLUMN     "payment_qr_url" TEXT,
ADD COLUMN     "payment_route_id" TEXT,
ADD COLUMN     "payment_routing_status" "trip_routing_status",
ADD COLUMN     "use_main_razorpay_account" BOOLEAN NOT NULL DEFAULT false;

