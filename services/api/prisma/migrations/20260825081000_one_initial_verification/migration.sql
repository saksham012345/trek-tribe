-- One initial verification request per organizer.
--
-- src/scripts/fix-duplicates.ts existed to clean these up after the fact: it
-- grouped verification requests by organizerId, found the ones with more than
-- one, picked a survivor by a priority ordering and deleted the rest. A script
-- that deletes duplicates is a constraint that was never written down.
--
-- The duplicates came from an asymmetry. auth.service.ts checks for an existing
-- request before creating one; the Google OAuth path in routes/auth.ts creates
-- unconditionally. Only one of the two paths was careful.
--
-- Partial rather than total, because requestType matters: an organizer has one
-- 'initial' request, and may legitimately submit 'kyc_update' or
-- 're_verification' more than once over time. Constraining all three would
-- break the two that are meant to repeat.
CREATE UNIQUE INDEX "verification_requests_one_initial_per_organizer"
  ON "verification_requests" ("organizer_id")
  WHERE "request_type" = 'initial';
