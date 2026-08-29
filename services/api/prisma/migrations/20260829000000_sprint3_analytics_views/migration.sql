-- Sprint 3 analytics views.
--
-- These are views, not tables, so they carry no migration risk beyond the
-- definitions themselves and can be replaced without touching data.
--
-- Two of the gate conditions are encoded here rather than in application code,
-- because that is where they stay true:
--
--   1. v_occupancy_by_trip sums SEATS, not booking rows. A GroupBooking holds
--      number_of_guests, so COUNT(*) over bookings under-reports occupancy by
--      exactly the group size minus one, per booking. The template computes
--      seats; counting rows is the spec slip this view exists to prevent.
--
--   2. Geography must reconcile: placed revenue + unplaced revenue equals total
--      lifetime spend, exactly. A trip with no coordinates cannot go on a map,
--      but its money is still real, so it lands in an explicit 'unplaced'
--      bucket rather than being dropped from the sum.
--
-- Seat-consuming bookings are confirmed + completed. A cancelled booking frees
-- its seats; a pending one has not taken them yet.

-- ---------------------------------------------------------------------------
-- 1. Occupancy
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_occupancy_by_trip AS
SELECT
  t.id                                        AS trip_id,
  t.organizer_id,
  t.title,
  t.destination,
  t.start_date,
  t.end_date,
  t.status,
  t.capacity,
  COALESCE(SUM(gb.number_of_guests), 0)::int  AS seats_booked,
  GREATEST(t.capacity - COALESCE(SUM(gb.number_of_guests), 0), 0)::int
                                              AS seats_remaining,
  COUNT(gb.id)::int                           AS booking_count,
  CASE
    WHEN t.capacity > 0
      THEN ROUND(COALESCE(SUM(gb.number_of_guests), 0)::numeric / t.capacity * 100, 2)
    ELSE 0
  END                                         AS fill_rate_pct
FROM trips t
LEFT JOIN group_bookings gb
  ON gb.trip_id = t.id
 AND gb.booking_status IN ('confirmed', 'completed')
GROUP BY t.id, t.organizer_id, t.title, t.destination,
         t.start_date, t.end_date, t.status, t.capacity;

-- ---------------------------------------------------------------------------
-- 2. Profitability
-- ---------------------------------------------------------------------------
-- Revenue is money actually received (paid_amount), not booked value
-- (final_amount) - a confirmed booking that has not paid is not profit. Both
-- are exposed so the difference stays visible instead of being argued about.
CREATE OR REPLACE VIEW v_trip_profitability AS
WITH booking_totals AS (
  SELECT
    gb.trip_id,
    COALESCE(SUM(gb.final_amount), 0)                  AS booked_value,
    COALESCE(SUM(COALESCE(gb.paid_amount, 0)), 0)      AS revenue_received,
    COALESCE(SUM(gb.discount_amount), 0)               AS discounts_given,
    COALESCE(SUM(gb.number_of_guests), 0)::int         AS seats_sold
  FROM group_bookings gb
  WHERE gb.booking_status IN ('confirmed', 'completed')
  GROUP BY gb.trip_id
),
expense_totals AS (
  SELECT e.trip_id, COALESCE(SUM(e.amount), 0) AS total_expenses
  FROM expenses e
  GROUP BY e.trip_id
)
SELECT
  t.id                                          AS trip_id,
  t.organizer_id,
  t.title,
  t.destination,
  t.start_date,
  t.status,
  COALESCE(b.booked_value, 0)                   AS booked_value,
  COALESCE(b.revenue_received, 0)               AS revenue_received,
  COALESCE(b.discounts_given, 0)                AS discounts_given,
  COALESCE(b.seats_sold, 0)                     AS seats_sold,
  COALESCE(x.total_expenses, 0)                 AS total_expenses,
  COALESCE(b.revenue_received, 0) - COALESCE(x.total_expenses, 0)
                                                AS net_profit,
  CASE
    WHEN COALESCE(b.revenue_received, 0) > 0
      THEN ROUND(
        (COALESCE(b.revenue_received, 0) - COALESCE(x.total_expenses, 0))
        / b.revenue_received * 100, 2)
    ELSE 0
  END                                           AS margin_pct
FROM trips t
LEFT JOIN booking_totals b ON b.trip_id = t.id
LEFT JOIN expense_totals x ON x.trip_id = t.id;

-- ---------------------------------------------------------------------------
-- 3. Customer geography
-- ---------------------------------------------------------------------------
-- The reconciliation gate: SUM(lifetime_spend) over this view equals total
-- lifetime spend across all bookings. Trips without coordinates are grouped
-- under is_placed = false rather than excluded, so nothing silently vanishes
-- from the total.
CREATE OR REPLACE VIEW v_customer_geography AS
SELECT
  t.organizer_id,
  COALESCE(NULLIF(TRIM(t.destination), ''), 'Unknown') AS destination,
  (t.latitude IS NOT NULL AND t.longitude IS NOT NULL)  AS is_placed,
  AVG(t.latitude)                                       AS latitude,
  AVG(t.longitude)                                      AS longitude,
  COUNT(DISTINCT gb.main_booker_id)::int                AS customer_count,
  COUNT(DISTINCT gb.id)::int                            AS booking_count,
  COALESCE(SUM(gb.number_of_guests), 0)::int            AS seats,
  COALESCE(SUM(COALESCE(gb.paid_amount, 0)), 0)         AS lifetime_spend
FROM trips t
JOIN group_bookings gb
  ON gb.trip_id = t.id
 AND gb.booking_status IN ('confirmed', 'completed')
GROUP BY
  t.organizer_id,
  COALESCE(NULLIF(TRIM(t.destination), ''), 'Unknown'),
  (t.latitude IS NOT NULL AND t.longitude IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 4. Marketing performance
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_marketing_performance AS
SELECT
  l.assigned_to                                              AS organizer_id,
  l.source,
  COUNT(*)::int                                              AS total_leads,
  COUNT(*) FILTER (WHERE l.status = 'converted')::int        AS converted_leads,
  COUNT(*) FILTER (WHERE l.status = 'lost')::int             AS lost_leads,
  COUNT(*) FILTER (WHERE l.status IN ('new','contacted','interested'))::int
                                                             AS open_leads,
  CASE
    WHEN COUNT(*) > 0
      THEN ROUND(COUNT(*) FILTER (WHERE l.status = 'converted')::numeric
                 / COUNT(*) * 100, 2)
    ELSE 0
  END                                                        AS conversion_rate_pct
FROM leads l
GROUP BY l.assigned_to, l.source;
