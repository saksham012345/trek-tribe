-- Sprint 9 — the AI harness, built before a provider is chosen.
--
-- O8 is unanswered. Six of this sprint's eight gate conditions are about the
-- machinery around the model rather than the model itself, and every one of
-- them is cheaper to get right before the first invoice than after it. A quota
-- that turns out to be broken after the bill arrives has already failed.
--
-- The harness fails closed: with no provider configured, generation refuses and
-- nothing is spent.

CREATE TYPE "ai_request_status" AS ENUM ('cache_hit', 'completed', 'refused', 'failed');
CREATE TYPE "ai_feature" AS ENUM (
    'trip_description', 'trip_itinerary', 'marketing_copy',
    'campaign_subject', 'insight_summary'
);

-- Every attempt, including the ones that never reached a provider.
--
-- The gate says the first invoice must reconcile against token totals here.
-- That only works if refusals and cache hits are recorded too: an invoice line
-- with no row here is either a billing error or a call this system does not
-- know it made, and telling those apart needs the whole record.
CREATE TABLE "ai_generation_requests" (
    "id"                TEXT NOT NULL,
    "organizer_id"      TEXT NOT NULL,
    "user_id"           TEXT NOT NULL,
    "feature"           "ai_feature" NOT NULL,
    "status"            "ai_request_status" NOT NULL,
    "cache_key"         TEXT NOT NULL,
    "provider"          TEXT,
    "model"             TEXT,
    "prompt_tokens"     INTEGER,
    "completion_tokens" INTEGER,
    "cost_paise"        INTEGER,
    "latency_ms"        INTEGER,
    "refusal_code"      TEXT,
    "error_text"        TEXT,
    "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_generation_requests_pkey" PRIMARY KEY ("id"),

    -- The gate: cache hit logs status=cache_hit with null tokens.
    --
    -- NULL and 0 are different claims. Zero says the provider was called and
    -- charged nothing; null says there was no call. Billing reconciliation
    -- depends on that distinction, so the table refuses to blur it.
    CONSTRAINT "ai_requests_no_tokens_without_a_call" CHECK (
        ("status" IN ('cache_hit', 'refused')
            AND "prompt_tokens" IS NULL
            AND "completion_tokens" IS NULL
            AND "cost_paise" IS NULL
            AND "provider" IS NULL)
        OR "status" IN ('completed', 'failed')
    ),
    -- A refusal has to say why. A refusal with no code is a dead end for
    -- whoever is looking at it three weeks later.
    CONSTRAINT "ai_requests_refusal_has_a_code" CHECK (
        "status" <> 'refused' OR "refusal_code" IS NOT NULL
    ),
    CONSTRAINT "ai_requests_tokens_not_negative" CHECK (
        ("prompt_tokens" IS NULL OR "prompt_tokens" >= 0)
        AND ("completion_tokens" IS NULL OR "completion_tokens" >= 0)
    )
);
CREATE INDEX "ai_generation_requests_organizer_id_created_at_idx"
    ON "ai_generation_requests"("organizer_id", "created_at");
CREATE INDEX "ai_generation_requests_cache_key_idx" ON "ai_generation_requests"("cache_key");
CREATE INDEX "ai_generation_requests_status_created_at_idx"
    ON "ai_generation_requests"("status", "created_at");

-- Cache. shareable decides whether the key is global or scoped to one
-- organizer, and it is stored rather than worked out at read time so a later
-- caller cannot get it wrong and serve one operator's numbers to another.
CREATE TABLE "ai_cache_entries" (
    "id"           TEXT NOT NULL,
    "cache_key"    TEXT NOT NULL,
    "feature"      "ai_feature" NOT NULL,
    "shareable"    BOOLEAN NOT NULL,
    "organizer_id" TEXT,
    "content"      TEXT NOT NULL,
    "provider"     TEXT,
    "model"        TEXT,
    "hits"         INTEGER NOT NULL DEFAULT 0,
    "last_hit_at"  TIMESTAMP(3),
    "expires_at"   TIMESTAMP(3),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_cache_entries_pkey" PRIMARY KEY ("id"),

    -- A personal entry must name whose it is; a shareable one must not, because
    -- an organizer id on a shared row is the beginning of a leak.
    CONSTRAINT "ai_cache_scope_matches_shareable" CHECK (
        ("shareable" = true  AND "organizer_id" IS NULL)
     OR ("shareable" = false AND "organizer_id" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX "ai_cache_entries_cache_key_key" ON "ai_cache_entries"("cache_key");
CREATE INDEX "ai_cache_entries_feature_idx" ON "ai_cache_entries"("feature");

-- Drafts. Generating writes here and nowhere else; accepting is what mutates.
CREATE TABLE "ai_drafts" (
    "id"           TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,
    "created_by"   TEXT NOT NULL,
    "feature"      "ai_feature" NOT NULL,
    "trip_id"      TEXT,
    "content"      TEXT NOT NULL,
    "request_id"   TEXT,
    "accepted_at"  TIMESTAMP(3),
    "accepted_by"  TEXT,
    "discarded_at" TIMESTAMP(3),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ai_drafts_pkey" PRIMARY KEY ("id"),

    -- A draft is open, accepted or discarded — never two of those.
    CONSTRAINT "ai_drafts_not_both_accepted_and_discarded" CHECK (
        "accepted_at" IS NULL OR "discarded_at" IS NULL
    ),
    -- Accepting records who did it. An accepted draft with no name is an edit
    -- nobody owns.
    CONSTRAINT "ai_drafts_acceptance_has_an_author" CHECK (
        ("accepted_at" IS NULL AND "accepted_by" IS NULL)
     OR ("accepted_at" IS NOT NULL AND "accepted_by" IS NOT NULL)
    )
);
CREATE INDEX "ai_drafts_organizer_id_created_at_idx" ON "ai_drafts"("organizer_id", "created_at");
CREATE INDEX "ai_drafts_trip_id_idx" ON "ai_drafts"("trip_id");

-- Quota, checked before the provider call. A quota checked afterwards has
-- already spent the money it was meant to prevent.
CREATE TABLE "ai_quotas" (
    "id"                    TEXT NOT NULL,
    "organizer_id"          TEXT NOT NULL,
    "monthly_request_limit" INTEGER NOT NULL DEFAULT 0,
    "monthly_token_limit"   INTEGER,
    "period_month"          TEXT NOT NULL,
    "requests_used"         INTEGER NOT NULL DEFAULT 0,
    "tokens_used"           INTEGER NOT NULL DEFAULT 0,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ai_quotas_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ai_quotas_counters_not_negative" CHECK (
        "requests_used" >= 0 AND "tokens_used" >= 0
    ),
    CONSTRAINT "ai_quotas_limits_not_negative" CHECK (
        "monthly_request_limit" >= 0
        AND ("monthly_token_limit" IS NULL OR "monthly_token_limit" >= 0)
    )
);
CREATE UNIQUE INDEX "ai_quotas_organizer_id_key" ON "ai_quotas"("organizer_id");

-- Spend per month, for reconciling the first provider invoice.
--
-- Cache hits and refusals appear with null token sums rather than zero, so a
-- month with heavy cache use does not read as a month where the provider
-- charged nothing.
CREATE OR REPLACE VIEW v_ai_spend_by_month AS
SELECT
    organizer_id,
    to_char(date_trunc('month', created_at), 'YYYY-MM') AS period,
    provider,
    COUNT(*)::int                                       AS attempts,
    COUNT(*) FILTER (WHERE status = 'completed')::int   AS provider_calls,
    COUNT(*) FILTER (WHERE status = 'cache_hit')::int   AS cache_hits,
    COUNT(*) FILTER (WHERE status = 'refused')::int     AS refused,
    COUNT(*) FILTER (WHERE status = 'failed')::int      AS failed,
    SUM(prompt_tokens)                                  AS prompt_tokens,
    SUM(completion_tokens)                              AS completion_tokens,
    COALESCE(SUM(cost_paise), 0)                        AS cost_paise
FROM ai_generation_requests
GROUP BY organizer_id, 2, provider;
