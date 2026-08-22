/*
  Warnings:

  - Made the column `integrations_twilio_from_number` on table `site_settings` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "site_settings" ALTER COLUMN "contact_otp_from_email" SET DEFAULT 'support@trektribe.com',
ALTER COLUMN "contact_booking_from_email" SET DEFAULT 'support@trektribe.com',
ALTER COLUMN "integrations_sms_provider" SET DEFAULT 'disabled',
ALTER COLUMN "integrations_twilio_from_number" SET NOT NULL,
ALTER COLUMN "integrations_twilio_from_number" SET DEFAULT '';
