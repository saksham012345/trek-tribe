-- Sprint 7 — coupons, and the floor that makes them safe.
--
-- O1 is unanswered. Rather than guess a business number or ship uncapped
-- stacking, the floor is required and the system fails closed: no floor
-- configured means no coupon can be applied. An unconfigured account sells at
-- full price, which is wrong in the safe direction.

CREATE TYPE "discount_floor_kind" AS ENUM ('max_total_percent', 'min_net_amount');
CREATE TYPE "coupon_kind" AS ENUM ('percent', 'fixed_amount');

CREATE TABLE "discount_floors" (
    "id"                TEXT NOT NULL,
    "organizer_id"      TEXT NOT NULL,
    "kind"              "discount_floor_kind" NOT NULL,
    "max_total_percent" DECIMAL(5,2),
    "min_net_paise"     INTEGER,
    "set_by"            TEXT,
    "set_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "discount_floors_pkey" PRIMARY KEY ("id"),
    -- The kind and the value must agree. A floor of kind max_total_percent
    -- with no percentage is not a floor, it is a row that looks like one.
    CONSTRAINT "discount_floors_value_matches_kind" CHECK (
        ("kind" = 'max_total_percent' AND "max_total_percent" IS NOT NULL AND "min_net_paise" IS NULL)
     OR ("kind" = 'min_net_amount'    AND "min_net_paise" IS NOT NULL AND "max_total_percent" IS NULL)
    ),
    CONSTRAINT "discount_floors_percent_in_range"
        CHECK ("max_total_percent" IS NULL OR ("max_total_percent" >= 0 AND "max_total_percent" <= 100)),
    CONSTRAINT "discount_floors_amount_not_negative"
        CHECK ("min_net_paise" IS NULL OR "min_net_paise" >= 0)
);
CREATE UNIQUE INDEX "discount_floors_organizer_id_key" ON "discount_floors"("organizer_id");

CREATE TABLE "coupons" (
    "id"               TEXT NOT NULL,
    "organizer_id"     TEXT NOT NULL,
    "code"             TEXT NOT NULL,
    "kind"             "coupon_kind" NOT NULL,
    "percent_off"      DECIMAL(5,2),
    "amount_off_paise" INTEGER,
    "starts_at"        TIMESTAMP(3) NOT NULL,
    "ends_at"          TIMESTAMP(3),
    "max_redemptions"  INTEGER,
    "times_redeemed"   INTEGER NOT NULL DEFAULT 0,
    "is_paused"        BOOLEAN NOT NULL DEFAULT false,
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "coupons_value_matches_kind" CHECK (
        ("kind" = 'percent'      AND "percent_off" IS NOT NULL AND "amount_off_paise" IS NULL)
     OR ("kind" = 'fixed_amount' AND "amount_off_paise" IS NOT NULL AND "percent_off" IS NULL)
    ),
    CONSTRAINT "coupons_percent_in_range"
        CHECK ("percent_off" IS NULL OR ("percent_off" > 0 AND "percent_off" <= 100)),
    CONSTRAINT "coupons_amount_positive"
        CHECK ("amount_off_paise" IS NULL OR "amount_off_paise" > 0),
    CONSTRAINT "coupons_window_is_ordered"
        CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at"),
    CONSTRAINT "coupons_redemptions_within_limit"
        CHECK ("max_redemptions" IS NULL OR "times_redeemed" <= "max_redemptions")
);
CREATE UNIQUE INDEX "coupons_organizer_id_code_key" ON "coupons"("organizer_id", "code");
CREATE INDEX "coupons_organizer_id_idx" ON "coupons"("organizer_id");

-- What each coupon actually took off a booking, so a reconciliation can say
-- later why a booking cost what it cost. Stacking is allowed per D6, so a
-- booking may carry several rows - but the same coupon cannot be applied to the
-- same booking twice.
CREATE TABLE "coupon_redemptions" (
    "id"             TEXT NOT NULL,
    "coupon_id"      TEXT NOT NULL,
    "booking_id"     TEXT NOT NULL,
    "discount_paise" INTEGER NOT NULL,
    "base_paise"     INTEGER NOT NULL,
    "redeemed_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "coupon_redemptions_discount_not_negative" CHECK ("discount_paise" >= 0),
    -- A single coupon can never take off more than the amount it applied to.
    -- The floor governs the total across stacked coupons; this governs each one.
    CONSTRAINT "coupon_redemptions_discount_within_base" CHECK ("discount_paise" <= "base_paise")
);
CREATE UNIQUE INDEX "coupon_redemptions_coupon_id_booking_id_key"
    ON "coupon_redemptions"("coupon_id", "booking_id");
CREATE INDEX "coupon_redemptions_booking_id_idx" ON "coupon_redemptions"("booking_id");
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey"
    FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Coupon state, derived from its window and its limit. Same posture as banners:
-- paused is a decision and is stored, expired and exhausted are arithmetic and
-- are not.
CREATE OR REPLACE VIEW v_coupon_state AS
SELECT
    c.*,
    CASE
        WHEN c.is_paused                                          THEN 'paused'
        WHEN c.starts_at > NOW()                                  THEN 'scheduled'
        WHEN c.ends_at IS NOT NULL AND c.ends_at <= NOW()         THEN 'expired'
        WHEN c.max_redemptions IS NOT NULL
             AND c.times_redeemed >= c.max_redemptions            THEN 'exhausted'
        ELSE 'live'
    END AS state
FROM coupons c;
