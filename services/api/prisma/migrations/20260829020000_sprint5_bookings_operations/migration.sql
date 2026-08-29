-- Sprint 5 — bookings and operations. 13 new tables.
--
-- Entirely additive: nothing existing reads these, and no existing table is
-- altered. The booking price lock the gate asks about needs no work here -
-- group_bookings already stores price_per_person and final_amount on the row,
-- and nothing recomputes them from trips.price, so changing a trip's price
-- cannot reach a booking that already exists.
--
-- O7 answered in shape, not in policy: the per-person tables key to
-- booking_participants, not to group_bookings. A party of four can therefore be
-- split across two rooms. Whether that is the product's intent is still the
-- user's call; this is the schema that does not make the wrong answer permanent.

CREATE TYPE "accommodation_kind" AS ENUM ('hotel', 'homestay', 'camp', 'hostel', 'guesthouse');
CREATE TYPE "transport_mode" AS ENUM ('bus', 'train', 'flight', 'cab', 'self');
CREATE TYPE "attendance_state" AS ENUM ('present', 'absent', 'late', 'excused');

-- ── Accommodation and rooms ─────────────────────────────────────────────────
CREATE TABLE "accommodations" (
    "id"         TEXT NOT NULL,
    "trip_id"    TEXT NOT NULL,
    "name"       TEXT NOT NULL,
    "kind"       "accommodation_kind" NOT NULL DEFAULT 'hotel',
    "address"    TEXT,
    "phone"      TEXT,
    "check_in"   TIMESTAMP(3),
    "check_out"  TIMESTAMP(3),
    "notes"      TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "accommodations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "accommodations_trip_id_idx" ON "accommodations"("trip_id");

CREATE TABLE "rooms" (
    "id"                TEXT NOT NULL,
    "accommodation_id"  TEXT NOT NULL,
    "label"             TEXT NOT NULL,
    "capacity"          INTEGER NOT NULL,
    "notes"             TEXT,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "rooms_accommodation_id_idx" ON "rooms"("accommodation_id");
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_accommodation_id_fkey"
    FOREIGN KEY ("accommodation_id") REFERENCES "accommodations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Over-capacity warns and allows; a duplicate assignment is refused.
--
-- Two rules, two places, deliberately. "This person is already in a room" is a
-- fact, so the database settles it with the unique constraint below. "This room
-- now holds five people in four beds" is a judgement the organiser may have a
-- reason for, so the API warns and lets it through rather than blocking the
-- night. There is no capacity CHECK here, and that absence is the design.
CREATE TABLE "room_assignments" (
    "id"             TEXT NOT NULL,
    "room_id"        TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "assigned_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by"    TEXT,
    CONSTRAINT "room_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "room_assignments_participant_id_key" ON "room_assignments"("participant_id");
CREATE INDEX "room_assignments_room_id_idx" ON "room_assignments"("room_id");
ALTER TABLE "room_assignments" ADD CONSTRAINT "room_assignments_room_id_fkey"
    FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "room_assignments" ADD CONSTRAINT "room_assignments_participant_id_fkey"
    FOREIGN KEY ("participant_id") REFERENCES "booking_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Transport ───────────────────────────────────────────────────────────────
CREATE TABLE "transport_segments" (
    "id"            TEXT NOT NULL,
    "trip_id"       TEXT NOT NULL,
    "mode"          "transport_mode" NOT NULL,
    "operator"      TEXT,
    "identifier"    TEXT,
    "from_location" TEXT NOT NULL,
    "to_location"   TEXT NOT NULL,
    "departs_at"    TIMESTAMP(3),
    "arrives_at"    TIMESTAMP(3),
    "seat_capacity" INTEGER,
    "notes"         TEXT,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "transport_segments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "transport_segments_trip_id_idx" ON "transport_segments"("trip_id");

CREATE TABLE "transport_assignments" (
    "id"             TEXT NOT NULL,
    "segment_id"     TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "seat_label"     TEXT,
    CONSTRAINT "transport_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "transport_assignments_segment_id_participant_id_key"
    ON "transport_assignments"("segment_id", "participant_id");
CREATE INDEX "transport_assignments_segment_id_idx" ON "transport_assignments"("segment_id");
ALTER TABLE "transport_assignments" ADD CONSTRAINT "transport_assignments_segment_id_fkey"
    FOREIGN KEY ("segment_id") REFERENCES "transport_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transport_assignments" ADD CONSTRAINT "transport_assignments_participant_id_fkey"
    FOREIGN KEY ("participant_id") REFERENCES "booking_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Checklists ──────────────────────────────────────────────────────────────
CREATE TABLE "checklist_templates" (
    "id"           TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "label"        TEXT NOT NULL,
    "description"  TEXT,
    "sort_order"   INTEGER NOT NULL DEFAULT 0,
    "is_required"  BOOLEAN NOT NULL DEFAULT false,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "checklist_templates_organizer_id_idx" ON "checklist_templates"("organizer_id");

-- The gate: toggle an item three times, the row count does not change. The
-- unique constraint is what makes that true regardless of how many tabs are
-- open or how fast the button is pressed - the toggle upserts against it rather
-- than inserting.
CREATE TABLE "booking_checklist_items" (
    "id"           TEXT NOT NULL,
    "booking_id"   TEXT NOT NULL,
    "template_id"  TEXT NOT NULL,
    "is_done"      BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT,
    "notes"        TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "booking_checklist_items_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "booking_checklist_items_booking_id_template_id_key"
    ON "booking_checklist_items"("booking_id", "template_id");
CREATE INDEX "booking_checklist_items_booking_id_idx" ON "booking_checklist_items"("booking_id");
ALTER TABLE "booking_checklist_items" ADD CONSTRAINT "booking_checklist_items_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "group_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "booking_checklist_items" ADD CONSTRAINT "booking_checklist_items_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "checklist_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Attendance ──────────────────────────────────────────────────────────────
CREATE TABLE "attendance_records" (
    "id"             TEXT NOT NULL,
    "trip_id"        TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "on_date"        DATE NOT NULL,
    "state"          "attendance_state" NOT NULL DEFAULT 'present',
    "notes"          TEXT,
    "marked_by"      TEXT,
    "marked_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "attendance_records_participant_id_on_date_key"
    ON "attendance_records"("participant_id", "on_date");
CREATE INDEX "attendance_records_trip_id_on_date_idx" ON "attendance_records"("trip_id", "on_date");
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_participant_id_fkey"
    FOREIGN KEY ("participant_id") REFERENCES "booking_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Equipment ───────────────────────────────────────────────────────────────
CREATE TABLE "equipment_items" (
    "id"          TEXT NOT NULL,
    "trip_id"     TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "total_units" INTEGER NOT NULL DEFAULT 0,
    "notes"       TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "equipment_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "equipment_items_trip_id_idx" ON "equipment_items"("trip_id");

CREATE TABLE "equipment_assignments" (
    "id"             TEXT NOT NULL,
    "equipment_id"   TEXT NOT NULL,
    "participant_id" TEXT NOT NULL,
    "units"          INTEGER NOT NULL DEFAULT 1,
    "issued_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returned_at"    TIMESTAMP(3),
    CONSTRAINT "equipment_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "equipment_assignments_equipment_id_participant_id_key"
    ON "equipment_assignments"("equipment_id", "participant_id");
CREATE INDEX "equipment_assignments_participant_id_idx" ON "equipment_assignments"("participant_id");
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_equipment_id_fkey"
    FOREIGN KEY ("equipment_id") REFERENCES "equipment_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_participant_id_fkey"
    FOREIGN KEY ("participant_id") REFERENCES "booking_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Permits ─────────────────────────────────────────────────────────────────
-- Expiry is a date and only a date. The gate says an expired permit must read
-- "expired" however it is stored; the way to guarantee that is to store it one
-- way and derive the word. A status column beside the date would go stale at
-- midnight with nothing watching it.
CREATE TABLE "permits" (
    "id"             TEXT NOT NULL,
    "trip_id"        TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "authority"      TEXT,
    "reference_code" TEXT,
    "issued_on"      DATE,
    "expires_on"     DATE,
    "document_url"   TEXT,
    "notes"          TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "permits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "permits_trip_id_idx" ON "permits"("trip_id");

-- ── Emergency plan ──────────────────────────────────────────────────────────
CREATE TABLE "emergency_plans" (
    "id"                    TEXT NOT NULL,
    "trip_id"               TEXT NOT NULL,
    "nearest_hospital"      TEXT,
    "hospital_phone"        TEXT,
    "hospital_distance_km"  DECIMAL(6,2),
    "evacuation_plan"       TEXT,
    "local_authority_phone" TEXT,
    "notes"                 TEXT,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "emergency_plans_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "emergency_plans_trip_id_key" ON "emergency_plans"("trip_id");

-- ── Documents ───────────────────────────────────────────────────────────────
-- Exactly one subject, enforced by the database.
--
-- num_nonnulls counts how many of the three subject columns are set. Requiring
-- exactly 1 rules out both "a document about nothing" and "a document about a
-- trip and a participant at once" - two states that are unanswerable the moment
-- someone asks what the file is for.
CREATE TABLE "ops_documents" (
    "id"             TEXT NOT NULL,
    "organizer_id"   TEXT NOT NULL,
    "trip_id"        TEXT,
    "booking_id"     TEXT,
    "participant_id" TEXT,
    "title"          TEXT NOT NULL,
    "category"       TEXT,
    "file_url"       TEXT NOT NULL,
    "file_name"      TEXT,
    "mime_type"      TEXT,
    "size_bytes"     INTEGER,
    "uploaded_by"    TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ops_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ops_documents_exactly_one_subject"
        CHECK (num_nonnulls("trip_id", "booking_id", "participant_id") = 1)
);
CREATE INDEX "ops_documents_trip_id_idx" ON "ops_documents"("trip_id");
CREATE INDEX "ops_documents_booking_id_idx" ON "ops_documents"("booking_id");
CREATE INDEX "ops_documents_participant_id_idx" ON "ops_documents"("participant_id");

-- ── Medical declarations ────────────────────────────────────────────────────
CREATE TABLE "medical_declarations" (
    "id"                 TEXT NOT NULL,
    "participant_id"     TEXT NOT NULL,
    "has_conditions"     BOOLEAN NOT NULL DEFAULT false,
    "conditions"         TEXT,
    "medications"        TEXT,
    "allergies"          TEXT,
    "blood_group"        TEXT,
    "physician_name"     TEXT,
    "physician_phone"    TEXT,
    "declared_at"        TIMESTAMP(3),
    "declaration_signed" BOOLEAN NOT NULL DEFAULT false,
    "created_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP(3) NOT NULL,
    CONSTRAINT "medical_declarations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "medical_declarations_participant_id_key" ON "medical_declarations"("participant_id");
ALTER TABLE "medical_declarations" ADD CONSTRAINT "medical_declarations_participant_id_fkey"
    FOREIGN KEY ("participant_id") REFERENCES "booking_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Certifications ──────────────────────────────────────────────────────────
CREATE TABLE "certifications" (
    "id"             TEXT NOT NULL,
    "organizer_id"   TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "issuing_body"   TEXT,
    "reference_code" TEXT,
    "issued_on"      DATE,
    "expires_on"     DATE,
    "document_url"   TEXT,
    "verified_at"    TIMESTAMP(3),
    "verified_by"    TEXT,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,
    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "certifications_organizer_id_idx" ON "certifications"("organizer_id");

-- ── Expiry, derived once ────────────────────────────────────────────────────
-- Both permits and certifications expire, and both store only a date. This view
-- is the single place the word "expired" is produced, so the gate condition
-- holds for every caller rather than for whichever ones remembered the rule.
CREATE OR REPLACE VIEW v_expiring_credentials AS
SELECT
    'permit'  AS kind,
    p.id,
    p.trip_id      AS scope_id,
    p.name,
    p.expires_on,
    CASE
        WHEN p.expires_on IS NULL             THEN 'no_expiry'
        WHEN p.expires_on < CURRENT_DATE      THEN 'expired'
        WHEN p.expires_on < CURRENT_DATE + 30 THEN 'expiring_soon'
        ELSE 'valid'
    END AS expiry_state
FROM permits p
UNION ALL
SELECT
    'certification' AS kind,
    c.id,
    c.organizer_id  AS scope_id,
    c.name,
    c.expires_on,
    CASE
        WHEN c.expires_on IS NULL             THEN 'no_expiry'
        WHEN c.expires_on < CURRENT_DATE      THEN 'expired'
        WHEN c.expires_on < CURRENT_DATE + 30 THEN 'expiring_soon'
        ELSE 'valid'
    END AS expiry_state
FROM certifications c;
