-- Bank details move from the User document to organizer_payout_configs.
--
-- The schema has said for a while that "bankDetails is deliberately not a
-- column" on users, and that bankDetailsController "reads and writes the User
-- path today and silently loses everything". That was accurate: entering bank
-- details returned 200 and stored nothing, because the adapter has no mapping
-- for the nested path and drops it without complaint.
--
-- organizer_payout_configs already holds the encrypted account number, the IFSC
-- and the holder's name. The one thing it lacks is the UPI id, which the form
-- collects and validates, so it is added here rather than quietly discarded.

ALTER TABLE "organizer_payout_configs"
  ADD COLUMN IF NOT EXISTS "upi_id" TEXT;
