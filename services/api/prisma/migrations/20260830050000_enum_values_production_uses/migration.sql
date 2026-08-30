-- Enum values the application records and Postgres did not know about.
--
-- Wave 9 wrote these enums from the Mongoose schema rather than from the data,
-- and Mongo never checked: it stores whatever string it is given. Migrating the
-- real rows found three values in production that no enum accepted.
--
--   user_activity_type       booking_started, organizer_profile_view
--   verification_request_type document_update
--
-- Mapping them onto the nearest existing value would have kept the row and lost
-- what it recorded — a profile view filed as a trip view is a wrong fact rather
-- than a missing one. The enum is what is wrong here, so the enum is what
-- changes.

ALTER TYPE "user_activity_type" ADD VALUE IF NOT EXISTS 'booking_started';
ALTER TYPE "user_activity_type" ADD VALUE IF NOT EXISTS 'organizer_profile_view';
ALTER TYPE "verification_request_type" ADD VALUE IF NOT EXISTS 'document_update';
