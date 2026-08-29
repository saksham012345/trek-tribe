-- Sprint 7 — marketing and growth, minus the discount floor.
--
-- coupons and discount_rules are deliberately not here. O1 asks for the floor
-- as a number and the gate requires it "enforced, not just displayed", so the
-- enforcement cannot be written before the number exists. A coupon table
-- without it would be the uncapped stacking the plan warns about, sitting in
-- the schema ready to be used.
--
-- Additive: five new tables, nothing existing altered.

CREATE TABLE "banners" (
    "id"           TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "body_text"    TEXT,
    "image_url"    TEXT,
    "link_url"     TEXT,
    "placement"    TEXT NOT NULL DEFAULT 'home',
    "starts_at"    TIMESTAMP(3) NOT NULL,
    "ends_at"      TIMESTAMP(3),
    "is_paused"    BOOLEAN NOT NULL DEFAULT false,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "banners_pkey" PRIMARY KEY ("id"),
    -- A window that ends before it starts is not a scheduling choice, it is a
    -- typo, and it produces a banner that can never be live with nothing to
    -- explain why.
    CONSTRAINT "banners_window_is_ordered"
        CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at")
);
CREATE INDEX "banners_organizer_id_starts_at_idx" ON "banners"("organizer_id", "starts_at");

CREATE TABLE "campaigns" (
    "id"            TEXT NOT NULL,
    "organizer_id"  TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "channel"       TEXT NOT NULL,
    "subject"       TEXT,
    "body"          TEXT,
    "scheduled_for" TIMESTAMP(3),
    "sent_at"       TIMESTAMP(3),
    "recipients"    INTEGER NOT NULL DEFAULT 0,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "campaigns_organizer_id_idx" ON "campaigns"("organizer_id");

CREATE TABLE "referrals" (
    "id"           TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "code"         TEXT NOT NULL,
    "referrer_id"  TEXT NOT NULL,
    "referred_id"  TEXT,
    "booking_id"   TEXT,
    "rewarded_at"  TIMESTAMP(3),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id"),
    -- Nobody refers themselves for a reward.
    CONSTRAINT "referrals_not_self" CHECK ("referred_id" IS NULL OR "referred_id" <> "referrer_id")
);
CREATE UNIQUE INDEX "referrals_code_key" ON "referrals"("code");
CREATE INDEX "referrals_organizer_id_idx" ON "referrals"("organizer_id");
CREATE INDEX "referrals_referrer_id_idx" ON "referrals"("referrer_id");

-- One request per booking, and one review per request. The gate is "matches
-- reviews back and is idempotent" - both halves are unique indexes, so asking
-- twice updates one row instead of emailing somebody a second time, and a
-- review cannot be credited to two requests.
CREATE TABLE "review_requests" (
    "id"             TEXT NOT NULL,
    "organizer_id"   TEXT NOT NULL,
    "booking_id"     TEXT NOT NULL,
    "trip_id"        TEXT NOT NULL,
    "sent_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reminded_at"    TIMESTAMP(3),
    "reminder_count" INTEGER NOT NULL DEFAULT 0,
    "review_id"      TEXT,
    "responded_at"   TIMESTAMP(3),
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "review_requests_pkey" PRIMARY KEY ("id"),
    -- A response carries both a review and a time, or neither.
    CONSTRAINT "review_requests_response_is_complete"
        CHECK (("review_id" IS NULL AND "responded_at" IS NULL)
            OR ("review_id" IS NOT NULL AND "responded_at" IS NOT NULL))
);
CREATE UNIQUE INDEX "review_requests_booking_id_key" ON "review_requests"("booking_id");
CREATE UNIQUE INDEX "review_requests_review_id_key" ON "review_requests"("review_id");
CREATE INDEX "review_requests_organizer_id_idx" ON "review_requests"("organizer_id");
CREATE INDEX "review_requests_trip_id_idx" ON "review_requests"("trip_id");

-- Append-only, and the table says so rather than the service promising it.
--
-- There is no updated_at column: nothing may edit a note, so there is nothing
-- for such a column to record. The gate is "adding one leaves earlier ones
-- byte-identical", and the surest way to hold that is for the row to have no
-- mutable field at all. A correction is a new note.
CREATE TABLE "customer_notes" (
    "id"           TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "lead_id"      TEXT,
    "booking_id"   TEXT,
    "customer_id"  TEXT,
    "body"         TEXT NOT NULL,
    "author_id"    TEXT NOT NULL,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_notes_exactly_one_subject"
        CHECK (num_nonnulls("lead_id", "booking_id", "customer_id") = 1)
);
CREATE INDEX "customer_notes_lead_id_created_at_idx" ON "customer_notes"("lead_id", "created_at");
CREATE INDEX "customer_notes_booking_id_created_at_idx" ON "customer_notes"("booking_id", "created_at");
CREATE INDEX "customer_notes_customer_id_created_at_idx" ON "customer_notes"("customer_id", "created_at");

-- Append-only enforced by the database, not by remembering.
--
-- A service can promise not to update, and the next caller writes an UPDATE
-- anyway. This refuses it at the table, so the promise survives people who
-- never read the promise.
CREATE OR REPLACE FUNCTION customer_notes_refuse_change() RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'customer_notes is append-only: notes cannot be % once written', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER customer_notes_no_update
    BEFORE UPDATE OR DELETE ON "customer_notes"
    FOR EACH ROW EXECUTE FUNCTION customer_notes_refuse_change();

-- Banner state, derived from the window. The single place the words "live",
-- "scheduled" and "expired" are produced for a banner.
CREATE OR REPLACE VIEW v_banner_state AS
SELECT
    b.*,
    CASE
        WHEN b.is_paused                        THEN 'paused'
        WHEN b.starts_at > NOW()                THEN 'scheduled'
        WHEN b.ends_at IS NOT NULL
             AND b.ends_at <= NOW()             THEN 'expired'
        ELSE 'live'
    END AS state
FROM banners b;

-- The CRM list, derived from bookings rather than from a customer table.
--
-- The gate: "a customer with no profile row still appears". Anyone who has ever
-- booked is a customer, whether or not somebody got around to creating a record
-- for them, so the list is built from the bookings themselves and the profile
-- is a left join that may find nothing.
CREATE OR REPLACE VIEW v_crm_customers AS
SELECT
    t.organizer_id,
    gb.main_booker_id                                   AS customer_id,
    u.name,
    u.email,
    u.phone,
    (u.id IS NULL)                                      AS profile_missing,
    COUNT(DISTINCT gb.id)::int                          AS bookings,
    COALESCE(SUM(gb.number_of_guests), 0)::int          AS seats,
    COALESCE(SUM(COALESCE(gb.paid_amount, 0)), 0)       AS lifetime_spend,
    MIN(gb.created_at)                                  AS first_booked_at,
    MAX(gb.created_at)                                  AS last_booked_at
FROM group_bookings gb
JOIN trips t ON t.id = gb.trip_id
LEFT JOIN users u ON u.id = gb.main_booker_id
WHERE gb.booking_status IN ('confirmed', 'completed')
GROUP BY t.organizer_id, gb.main_booker_id, u.id, u.name, u.email, u.phone;
