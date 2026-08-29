-- Sprint 8 — team, roles, invites and calendar sync.
--
-- Additive: four new tables, nothing existing altered.
--
-- Two of the sprint's gate conditions are database constraints rather than
-- application checks, because both are the kind of rule that two concurrent
-- requests can walk straight through when it lives in TypeScript.

CREATE TYPE "team_role" AS ENUM ('owner', 'manager', 'trip_leader', 'viewer');
CREATE TYPE "membership_status" AS ENUM ('active', 'suspended', 'removed');

CREATE TABLE "team_memberships" (
    "id"           TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "user_id"      TEXT NOT NULL,
    "role"         "team_role" NOT NULL DEFAULT 'viewer',
    "status"       "membership_status" NOT NULL DEFAULT 'active',
    "invited_by"   TEXT,
    "joined_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at"   TIMESTAMP(3),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

-- Gate: "one active membership per person - partial unique index, enforced by
-- the database".
--
-- Partial is the whole point. A plain UNIQUE(organizer_id, user_id) would say
-- "this person may only ever appear once", which refuses to re-hire someone who
-- left. WHERE status = 'active' says the narrower and correct thing: they may
-- have any number of finished memberships and exactly one live one.
--
-- It is in the database rather than a findFirst-then-insert because two invite
-- acceptances arriving together both read "no active membership" and both
-- write one. The index refuses the second regardless of timing.
CREATE UNIQUE INDEX "team_memberships_one_active_per_person"
    ON "team_memberships"("organizer_id", "user_id")
    WHERE "status" = 'active';

CREATE INDEX "team_memberships_organizer_id_status_idx" ON "team_memberships"("organizer_id", "status");
CREATE INDEX "team_memberships_user_id_idx" ON "team_memberships"("user_id");

CREATE TABLE "team_invites" (
    "id"           TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "role"         "team_role" NOT NULL DEFAULT 'viewer',
    "token"        TEXT,
    "expires_at"   TIMESTAMP(3) NOT NULL,
    "invited_by"   TEXT,
    "accepted_at"  TIMESTAMP(3),
    "user_id"      TEXT,
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "team_invites_pkey" PRIMARY KEY ("id")
);

-- Unique on the token, but only while there is one. Accepting sets token to
-- NULL, and Postgres treats NULLs as distinct in a unique index, so spent
-- invites pile up harmlessly while a live token stays unique. Written partial
-- anyway so the intent is readable rather than relying on that NULL behaviour
-- being remembered.
CREATE UNIQUE INDEX "team_invites_token_key"
    ON "team_invites"("token")
    WHERE "token" IS NOT NULL;

-- An invite that has been accepted must carry both the timestamp and the user
-- it resolved to, and must have surrendered its token. Half-accepted is not a
-- state anything should be able to write.
ALTER TABLE "team_invites" ADD CONSTRAINT "team_invites_accepted_is_complete"
    CHECK (
        ("accepted_at" IS NULL AND "user_id" IS NULL)
        OR ("accepted_at" IS NOT NULL AND "user_id" IS NOT NULL AND "token" IS NULL)
    );

CREATE INDEX "team_invites_organizer_id_idx" ON "team_invites"("organizer_id");
CREATE INDEX "team_invites_email_idx" ON "team_invites"("email");

CREATE TABLE "trip_leader_assignments" (
    "id"            TEXT NOT NULL,
    "membership_id" TEXT NOT NULL,
    "trip_id"       TEXT NOT NULL,
    "assigned_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by"   TEXT,
    CONSTRAINT "trip_leader_assignments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "trip_leader_assignments_membership_id_trip_id_key"
    ON "trip_leader_assignments"("membership_id", "trip_id");
CREATE INDEX "trip_leader_assignments_trip_id_idx" ON "trip_leader_assignments"("trip_id");
ALTER TABLE "trip_leader_assignments" ADD CONSTRAINT "trip_leader_assignments_membership_id_fkey"
    FOREIGN KEY ("membership_id") REFERENCES "team_memberships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Gate: "repeat calendar push updates, never duplicates".
--
-- UNIQUE(trip_id, provider) with an upsert on top. Two pushes racing produce
-- one row and one update rather than two events on somebody's calendar, which
-- is the failure people actually notice.
CREATE TABLE "calendar_syncs" (
    "id"                TEXT NOT NULL,
    "trip_id"           TEXT NOT NULL,
    "provider"          TEXT NOT NULL,
    "external_event_id" TEXT NOT NULL,
    "last_pushed_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_payload_hash" TEXT,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"        TIMESTAMP(3) NOT NULL,
    CONSTRAINT "calendar_syncs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "calendar_syncs_trip_id_provider_key" ON "calendar_syncs"("trip_id", "provider");
