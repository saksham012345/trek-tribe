-- Sprint 4 — trips depth.
--
-- The plan calls this the riskiest migration in the whole build, on the most
-- load-bearing table in the product. Everything here is additive: no column is
-- dropped, no column is retyped, and no existing value is overwritten. A trip
-- that was visible and bookable before this runs is visible and bookable
-- after, because nothing it depends on changed.
--
-- The one row-touching statement is the backfill in step 3, and it writes only
-- to a column that did not exist a moment earlier.

-- 1. Publication status is a new axis, not a replacement for trip_status.
--    trip_status keeps saying what is happening to a trip (running, cancelled,
--    completed); this says whether the public may see it. Merging them would
--    require backfilling every row to 'published' and losing 'cancelled' and
--    'completed' in the process.
CREATE TYPE "trip_publication_status" AS ENUM ('draft', 'scheduled', 'published', 'archived');

-- 2. Templates and series.
--    A template lives in its own table rather than as a flagged trip, so it
--    cannot be returned by any query that reads `trips`. The sprint gate
--    "templates never appear as trips" then holds because there is no row to
--    find, not because every listing query remembered to filter.
CREATE TABLE "trip_templates" (
    "id"               TEXT NOT NULL,
    "organizer_id"     TEXT NOT NULL,
    "name"             TEXT NOT NULL,
    "title"            TEXT NOT NULL,
    "description"      TEXT,
    "destination"      TEXT,
    "difficulty"       "trip_difficulty" NOT NULL DEFAULT 'moderate',
    "categories"       TEXT[],
    "capacity"         INTEGER,
    "price"            DECIMAL(14,2),
    "duration_days"    INTEGER,
    "itinerary"        TEXT,
    "included_items"   TEXT[],
    "excluded_items"   TEXT[],
    "safety_equipment" TEXT[],
    "times_used"       INTEGER NOT NULL DEFAULT 0,
    "last_used_at"     TIMESTAMP(3),
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "trip_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "trip_templates_organizer_id_idx" ON "trip_templates"("organizer_id");

CREATE TABLE "trip_series" (
    "id"              TEXT NOT NULL,
    "organizer_id"    TEXT NOT NULL,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "recurrence_rule" TEXT,
    "starts_on"       TIMESTAMP(3),
    "ends_on"         TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "trip_series_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "trip_series_organizer_id_idx" ON "trip_series"("organizer_id");

-- 3. The five new columns on trips.
--
--    The column default is 'draft', so anything created from here on - a new
--    trip, a duplicate - starts unlisted and has to be published deliberately.
--    That is the gate condition "a duplicate is draft at 0% fill".
--
--    Existing rows are then backfilled to 'published' in a single UPDATE. They
--    are already live and selling; leaving them at the column default would
--    unlist the entire catalogue the moment this deployed. The UPDATE runs once
--    here and never again, so later inserts still get 'draft'.
ALTER TABLE "trips"
    ADD COLUMN "publication_status" "trip_publication_status" NOT NULL DEFAULT 'draft',
    ADD COLUMN "publish_at" TIMESTAMP(3),
    ADD COLUMN "series_id" TEXT,
    ADD COLUMN "template_id" TEXT,
    ADD COLUMN "duplicated_from_trip_id" TEXT;

UPDATE "trips" SET "publication_status" = 'published';

-- 4. Foreign keys. SetNull on both: deleting a template or a series must not
--    delete departures that have been sold. The grouping is a convenience; the
--    trip is the real thing.
ALTER TABLE "trips" ADD CONSTRAINT "trips_series_id_fkey"
    FOREIGN KEY ("series_id") REFERENCES "trip_series"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "trip_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "trips_publication_status_idx" ON "trips"("publication_status");
CREATE INDEX "trips_series_id_idx" ON "trips"("series_id");
CREATE INDEX "trips_template_id_idx" ON "trips"("template_id");

-- 5. Public visibility, as a view rather than a rule each caller reimplements.
--
--    A trip is publicly listable when it is published, its scheduled publish
--    time has passed (or was never set), it is not private, and it has not been
--    cancelled. Draft and scheduled trips are absent from this view by
--    construction - the second sprint gate condition.
CREATE OR REPLACE VIEW v_public_trips AS
SELECT t.*
FROM trips t
WHERE t.publication_status = 'published'
  AND (t.publish_at IS NULL OR t.publish_at <= NOW())
  AND t.is_private = FALSE
  AND t.status <> 'cancelled';
