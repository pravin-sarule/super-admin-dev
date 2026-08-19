-- =====================================================================================
-- Citation Analytics cost schema  —  TARGET DATABASE: citationTest  (CITATION_ANALYTICS_DB_URL)
-- =====================================================================================
--
--  ⚠  DO NOT RUN THIS AGAINST citation_db.
--     citation_db backs the Overview / HITL Queue / Data Pipeline / Routes & DB /
--     Business Metrics tabs and must not receive any DDL. The companion runner
--     (run_citation_usage_events_migration.js) refuses to execute unless the target
--     database is named "citationTest".
--
--  ⚠  citation_usage_events is the SINGLE SOURCE OF TRUTH for citation cost.
--     Never sum it together with judgement_sessions.payload->'costLedger' — that
--     double-counts. costLedger remains a live per-session snapshot only.
--
--  ⚠  citation_usage_events is APPEND-ONLY (enforced by trigger). Corrections are
--     compensating rows carrying metadata->>'corrects_event_key', never UPDATEs.
--     Deliberate DBA work: SET LOCAL citation.allow_cost_mutation = 'on';
--
--  Idempotent — safe to run repeatedly.
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- 1. RATE CARD  (created first — the events pricing trigger reads it)
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS citation_rate_card (
    id            BIGSERIAL PRIMARY KEY,
    version       TEXT NOT NULL DEFAULT 'v1',
    provider      TEXT NOT NULL,                      -- gemini|claude|indian_kanoon|document_ai|serper
    service       TEXT NOT NULL,                      -- score-card bucket
    model         TEXT,                               -- NULL = matches any model
    operation     TEXT,                               -- NULL = matches any operation
    tier          TEXT NOT NULL DEFAULT 'standard',   -- 'intro' | 'standard'
    display_name  TEXT,
    unit          TEXT NOT NULL,                      -- tokens|calls|pages
    currency      TEXT NOT NULL DEFAULT 'USD',        -- currency the rate columns are expressed in
    -- Live FX peg. Editable per row from the Rate Card admin panel; refresh it when the
    -- rupee moves. (The legacy engine hardcoded 85.00, which is why its USD figures drifted.)
    inr_per_usd   NUMERIC(12,4) NOT NULL DEFAULT 95.66,

    input_rate_per_million              NUMERIC(14,6) NOT NULL DEFAULT 0,
    output_rate_per_million             NUMERIC(14,6) NOT NULL DEFAULT 0,
    cached_input_rate_per_million       NUMERIC(14,6) NOT NULL DEFAULT 0,
    cache_storage_rate_per_million_hour NUMERIC(14,6) NOT NULL DEFAULT 0,
    flat_rate_per_unit                  NUMERIC(14,6) NOT NULL DEFAULT 0,

    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    effective_to   TIMESTAMPTZ,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    notes          TEXT,
    updated_by     TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_rate_unit     CHECK (unit IN ('tokens','calls','pages')),
    CONSTRAINT ck_rate_currency CHECK (currency IN ('USD','INR')),
    CONSTRAINT ck_rate_window   CHECK (effective_to IS NULL OR effective_to > effective_from),
    CONSTRAINT ck_rate_fx       CHECK (inr_per_usd > 0),
    CONSTRAINT ck_rate_nonneg   CHECK (
        input_rate_per_million >= 0 AND output_rate_per_million >= 0
        AND cached_input_rate_per_million >= 0 AND cache_storage_rate_per_million_hour >= 0
        AND flat_rate_per_unit >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rate_card_key ON citation_rate_card
    (provider, COALESCE(model, '*'), COALESCE(operation, '*'), tier, effective_from);

CREATE INDEX IF NOT EXISTS idx_rate_card_active
    ON citation_rate_card (provider, model, operation) WHERE is_active;


-- -------------------------------------------------------------------------------------
-- 2. EVENTS  —  append-only, one row per API call
-- -------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS citation_usage_events (
    id              BIGSERIAL PRIMARY KEY,
    event_key       TEXT,                             -- producer idempotency key
    session_id      TEXT,                             -- judgement_sessions.session_id
    run_id          TEXT,
    step_no         INTEGER,
    user_id         TEXT NOT NULL DEFAULT 'anonymous',-- Auth_DB.users.id AS TEXT
    case_id         TEXT,
    doc_id          TEXT,                             -- judgement_vault.doc_id
    provider        TEXT NOT NULL,
    service         TEXT NOT NULL,
    operation       TEXT NOT NULL,
    stage           TEXT,
    model           TEXT,
    unit            TEXT NOT NULL DEFAULT 'calls',
    quantity        BIGINT  NOT NULL DEFAULT 0,       -- billable units
    calls           INTEGER NOT NULL DEFAULT 1,
    input_tokens    BIGINT  NOT NULL DEFAULT 0,
    output_tokens   BIGINT  NOT NULL DEFAULT 0,
    cached_tokens   BIGINT  NOT NULL DEFAULT 0,       -- subset of input_tokens served from cache
    cache_hit       BOOLEAN NOT NULL DEFAULT FALSE,   -- wholly free call

    -- money: owned by the pricing trigger, NOT by the producer
    cost_inr          NUMERIC(18,6),
    cost_usd          NUMERIC(18,8),
    producer_cost_inr NUMERIC(18,6),                  -- engine's own figure (drift signal only)
    producer_cost_usd NUMERIC(18,8),
    rate_version      TEXT,
    cost_source       TEXT NOT NULL DEFAULT 'rate_card',
    applied_inr_per_usd NUMERIC(12,4),

    usage_time_ms   BIGINT  NOT NULL DEFAULT 0,
    success         BOOLEAN NOT NULL DEFAULT TRUE,
    error_code      TEXT,
    error_message   TEXT,
    source          TEXT NOT NULL DEFAULT 'engine',   -- engine|legacy|backfill
    metadata        JSONB   NOT NULL DEFAULT '{}'::jsonb,
    occurred_at     TIMESTAMPTZ NOT NULL,             -- producer clock: when the call happened
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ck_cue_unit        CHECK (unit IN ('tokens','calls','pages','documents','characters','other')),
    CONSTRAINT ck_cue_cost_source CHECK (cost_source IN ('rate_card','producer','manual','unpriced')),
    CONSTRAINT ck_cue_source      CHECK (source IN ('engine','legacy','backfill')),
    CONSTRAINT ck_cue_nonneg      CHECK (
        quantity >= 0 AND calls >= 0 AND input_tokens >= 0
        AND output_tokens >= 0 AND cached_tokens >= 0
        AND COALESCE(cost_inr, 0) >= 0 AND COALESCE(cost_usd, 0) >= 0),
    CONSTRAINT ck_cue_sane_time   CHECK (occurred_at > TIMESTAMPTZ '2024-01-01')
);

-- Idempotency: backs `ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING`.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cue_event_key
    ON citation_usage_events (event_key) WHERE event_key IS NOT NULL;

-- Every dashboard query is date-ranged; also serves MAX(occurred_at) by backwards scan.
CREATE INDEX IF NOT EXISTS idx_cue_occurred
    ON citation_usage_events (occurred_at DESC);

-- User breakdown GROUP BY / drill-down / department filter (which lands as user_id = ANY(...)).
CREATE INDEX IF NOT EXISTS idx_cue_user_occurred
    ON citation_usage_events (user_id, occurred_at DESC);

-- Score cards: GROUP BY service within range.
CREATE INDEX IF NOT EXISTS idx_cue_svc_occurred
    ON citation_usage_events (service, occurred_at DESC);

-- Per-session rollup + reconciliation against payload->'costLedger'.
CREATE INDEX IF NOT EXISTS idx_cue_session
    ON citation_usage_events (session_id) WHERE session_id IS NOT NULL;

-- Retry/run tracing. Partial: run_id is often NULL.
CREATE INDEX IF NOT EXISTS idx_cue_run
    ON citation_usage_events (run_id) WHERE run_id IS NOT NULL;

-- Per-document cost attribution.
CREATE INDEX IF NOT EXISTS idx_cue_doc
    ON citation_usage_events (doc_id) WHERE doc_id IS NOT NULL;

-- Surfaces models missing from the rate card (the failure that caused the 4x under-report).
CREATE INDEX IF NOT EXISTS idx_cue_unpriced
    ON citation_usage_events (occurred_at DESC) WHERE cost_source = 'unpriced';

-- Ingestion-lag monitoring (created_at vs occurred_at skew).
CREATE INDEX IF NOT EXISTS idx_cue_created
    ON citation_usage_events (created_at DESC);


-- -------------------------------------------------------------------------------------
-- 3. RATE RESOLUTION  —  most specific active row whose window contains the event time
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION citation_rate_lookup(
    p_provider  TEXT,
    p_model     TEXT,
    p_operation TEXT,
    p_at        TIMESTAMPTZ
) RETURNS citation_rate_card AS $$
    SELECT r.*
    FROM citation_rate_card r
    WHERE r.is_active
      AND r.provider = p_provider
      AND (r.model     IS NULL OR r.model     = p_model)
      AND (r.operation IS NULL OR r.operation = p_operation)
      AND r.effective_from <= p_at
      AND (r.effective_to IS NULL OR r.effective_to > p_at)
    ORDER BY (r.model IS NOT NULL) DESC,        -- exact model beats wildcard
             (r.operation IS NOT NULL) DESC,    -- exact operation beats wildcard
             r.effective_from DESC,
             r.id DESC                          -- final tiebreak: fully deterministic
    LIMIT 1;
$$ LANGUAGE sql STABLE;


-- -------------------------------------------------------------------------------------
-- 4. PRICING TRIGGER  —  the database prices the event, not the engine
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION citation_usage_events_fill_cost() RETURNS trigger AS $$
DECLARE
    r             citation_rate_card%ROWTYPE;
    native        NUMERIC(24,10) := 0;
    billable      NUMERIC(24,10) := 0;
    uncached_in   NUMERIC(24,10) := 0;
    fx            NUMERIC(12,4);
BEGIN
    -- (a) explicit cost supplied => manual override, rate card bypassed
    IF NEW.cost_inr IS NOT NULL OR NEW.cost_usd IS NOT NULL THEN
        NEW.cost_inr    := COALESCE(NEW.cost_inr, 0);
        NEW.cost_usd    := COALESCE(NEW.cost_usd, 0);
        NEW.cost_source := 'manual';
        RETURN NEW;
    END IF;

    -- (b) a wholly cached call is free, but still counted
    IF NEW.cache_hit THEN
        NEW.cost_inr := 0;
        NEW.cost_usd := 0;
        NEW.cost_source := 'rate_card';
        NEW.rate_version := 'free-cache-hit';
        RETURN NEW;
    END IF;

    r := citation_rate_lookup(NEW.provider, NEW.model, NEW.operation, NEW.occurred_at);

    IF r.id IS NOT NULL THEN
        IF NEW.unit = 'tokens' THEN
            uncached_in := GREATEST(NEW.input_tokens - NEW.cached_tokens, 0);
            native :=   (uncached_in       / 1000000.0) * r.input_rate_per_million
                      + (NEW.cached_tokens / 1000000.0) * r.cached_input_rate_per_million
                      + (NEW.output_tokens / 1000000.0) * r.output_rate_per_million;
        ELSE
            -- 'calls' bills per call; 'pages'/'documents'/etc. bill per quantity
            billable := CASE WHEN NEW.unit = 'calls'
                             THEN NEW.calls
                             ELSE COALESCE(NULLIF(NEW.quantity, 0), NEW.calls) END;
            native := billable * r.flat_rate_per_unit;
        END IF;

        IF r.currency = 'INR' THEN
            NEW.cost_inr := native;
            NEW.cost_usd := native / r.inr_per_usd;
        ELSE
            NEW.cost_usd := native;
            NEW.cost_inr := native * r.inr_per_usd;
        END IF;

        NEW.rate_version        := r.version;
        NEW.applied_inr_per_usd := r.inr_per_usd;
        NEW.cost_source         := 'rate_card';

    ELSIF NEW.producer_cost_inr IS NOT NULL OR NEW.producer_cost_usd IS NOT NULL THEN
        -- (c) no rate card row: fall back to whatever the engine computed.
        --
        -- The engine almost always sends ONE currency (India Kanoon is INR-native, so it
        -- reports rupees only). COALESCE(...,0) on the other side booked those rows as
        -- INR-with-$0.00, which is not a rounding artefact — it silently drags the
        -- dashboard's INR:USD ratio away from the real peg. Derive the missing side from
        -- the prevailing rate so both totals stay reconcilable.
        SELECT c.inr_per_usd INTO fx
          FROM citation_rate_card c
         WHERE c.is_active
           AND LOWER(TRIM(c.provider)) = LOWER(TRIM(NEW.provider))
           AND c.effective_from <= NEW.occurred_at
         ORDER BY c.effective_from DESC
         LIMIT 1;

        IF fx IS NULL THEN
            -- Unknown provider: any active rate carries the same USD peg.
            SELECT c.inr_per_usd INTO fx
              FROM citation_rate_card c
             WHERE c.is_active
             ORDER BY c.effective_from DESC
             LIMIT 1;
        END IF;

        fx := COALESCE(NULLIF(fx, 0), 95.66);

        NEW.cost_inr := COALESCE(NEW.producer_cost_inr, NEW.producer_cost_usd * fx, 0);
        NEW.cost_usd := COALESCE(NEW.producer_cost_usd, NEW.producer_cost_inr / fx, 0);
        NEW.applied_inr_per_usd := fx;
        NEW.rate_version := 'producer';
        NEW.cost_source  := 'producer';

    ELSE
        -- (d) nothing to price with: record zero and flag it loudly
        NEW.cost_inr    := 0;
        NEW.cost_usd    := 0;
        NEW.rate_version := 'unpriced';
        NEW.cost_source  := 'unpriced';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cue_fill_cost ON citation_usage_events;
CREATE TRIGGER trg_cue_fill_cost
    BEFORE INSERT ON citation_usage_events
    FOR EACH ROW EXECUTE FUNCTION citation_usage_events_fill_cost();


-- -------------------------------------------------------------------------------------
-- 5. APPEND-ONLY GUARD
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION citation_usage_events_append_only() RETURNS trigger AS $$
BEGIN
    IF current_setting('citation.allow_cost_mutation', true) = 'on' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;
    RAISE EXCEPTION
        'citation_usage_events is append-only (% blocked). Insert a compensating row carrying metadata->>''corrects_event_key'' instead.',
        TG_OP
        USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cue_append_only ON citation_usage_events;
CREATE TRIGGER trg_cue_append_only
    BEFORE UPDATE OR DELETE ON citation_usage_events
    FOR EACH ROW EXECUTE FUNCTION citation_usage_events_append_only();


-- -------------------------------------------------------------------------------------
-- 6. CANONICAL VIEW  —  the single place a vendor score-card bucket is defined
-- -------------------------------------------------------------------------------------
-- A score card is a VENDOR (who bills us), so the bucket resolves from `provider`, never
-- from the producer's free-text `service`.
--
-- Why: on 2026-08-18 the engine changed `service` from 'gemini' to 'judgement_ai' while
-- still calling gemini-2.5-flash / gemini-3.6-flash / gemini-embedding-001 with
-- provider='gemini'. That split one vendor's spend across two score cards mid-week — the
-- Gemini card read ₹0.00 for every range after the 18th while ₹74 of Gemini spend sat in
-- a card named after the engine's own product. `provider` is the stable identity; the
-- engine may rename `service` again and the Gemini card will still total all Gemini cost.
--
-- `service` is NOT discarded — it stays on every row, and the run breakdown still splits
-- by operation/agent (judgment_verifier, keyword_extract, …), so nothing is lost.
CREATE OR REPLACE VIEW v_citation_usage_events AS
SELECT
    e.*,
    CASE
        WHEN LOWER(TRIM(e.provider)) IN ('gemini', 'google', 'google_ai', 'vertex_ai')
            THEN 'gemini'
        WHEN LOWER(TRIM(e.provider)) IN ('claude', 'anthropic')
            THEN 'claude'
        WHEN LOWER(TRIM(e.provider)) IN (
            'indian_kanoon', 'india_kanoon', 'indiakanoon',
            'india_kanoon_api', 'indian_kanoon_api', 'inidia_kanoon'
        ) THEN 'india_kanoon'
        WHEN LOWER(TRIM(e.provider)) IN ('document_ai', 'documentai', 'google_document_ai')
            THEN 'document_ai'
        WHEN LOWER(TRIM(e.provider)) = 'openai'  THEN 'openai'
        WHEN LOWER(TRIM(e.provider)) = 'serper'  THEN 'serper'
        -- Unrecognised provider: fall back to the service label, preserving the original
        -- India Kanoon alias merge so an event with a blank/odd provider still buckets.
        WHEN LOWER(TRIM(e.service)) IN (
            'indian_kanoon', 'india_kanoon', 'indiakanoon',
            'india_kanoon_api', 'indian_kanoon_api', 'inidia_kanoon'
        ) THEN 'india_kanoon'
        ELSE LOWER(TRIM(e.service))
    END AS service_canonical,
    COALESCE(NULLIF(TRIM(e.user_id), ''), 'unknown') AS user_key
FROM citation_usage_events e;


-- -------------------------------------------------------------------------------------
-- 7. SESSION ROLLUP  —  reproduces the engine's "COMPLETE COST — END-TO-END session" block
-- -------------------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_citation_session_cost AS
SELECT
    session_id,
    MAX(user_id) AS user_id,
    MAX(case_id) AS case_id,
    COUNT(*)::bigint          AS event_count,
    SUM(calls)::bigint        AS total_calls,
    SUM(input_tokens)::bigint AS total_input_tokens,
    SUM(output_tokens)::bigint AS total_output_tokens,
    COUNT(*) FILTER (WHERE cache_hit)::bigint AS cache_hits,
    COALESCE(SUM(cost_inr) FILTER (WHERE provider IN ('gemini','claude','openai')), 0)::numeric(18,6) AS ai_cost_inr,
    COALESCE(SUM(cost_inr) FILTER (WHERE provider = 'indian_kanoon'), 0)::numeric(18,6)               AS ik_cost_inr,
    COALESCE(SUM(cost_inr), 0)::numeric(18,6) AS total_cost_inr,
    COALESCE(SUM(cost_usd), 0)::numeric(18,8) AS total_cost_usd,
    MIN(occurred_at) AS started_at,
    MAX(occurred_at) AS last_event_at
FROM citation_usage_events
WHERE session_id IS NOT NULL
GROUP BY session_id;


-- =====================================================================================
-- 8. SEED — rate card v1
--    Gemini/Claude: published USD list prices, pegged at INR 85.00/USD.
--    India Kanoon / Document AI / Serper: INR-native, recovered exactly from the
--    17,702 legacy citation_service_usage rows and confirmed against engine output.
--
--    Guarded as a whole: seeds only when version 'v1' is absent. Re-running never
--    duplicates rows and never overwrites prices an admin has since edited.
-- =====================================================================================
DO $seed$
BEGIN
IF EXISTS (SELECT 1 FROM citation_rate_card WHERE version = 'v1') THEN
    RAISE NOTICE 'Rate card v1 already seeded — skipping seed block.';
    RETURN;
END IF;

-- 8a. Gemini token models (USD per 1M tokens) ------------------------------------------
INSERT INTO citation_rate_card
    (version, provider, service, model, operation, tier, display_name, unit, currency, inr_per_usd,
     input_rate_per_million, output_rate_per_million, cached_input_rate_per_million,
     cache_storage_rate_per_million_hour, is_active, notes, updated_by)
VALUES
    ('v1','gemini','gemini','gemini-3.7-flash',      NULL,'intro',   'Gemini 3.7 Flash (Intro)',   'tokens','USD',95.66, 0.75, 3.75, 0.075, 0.50, FALSE,'Promotional intro pricing — activate while the promo runs','migration'),
    ('v1','gemini','gemini','gemini-3.7-flash',      NULL,'standard','Gemini 3.7 Flash',           'tokens','USD',95.66, 1.50, 7.50, 0.150, 1.00, TRUE, NULL,'migration'),
    ('v1','gemini','gemini','gemini-3.6-flash',      NULL,'intro',   'Gemini 3.6 Flash (Intro)',   'tokens','USD',95.66, 0.75, 3.75, 0.075, 0.50, FALSE,'Promotional intro pricing — activate while the promo runs','migration'),
    ('v1','gemini','gemini','gemini-3.6-flash',      NULL,'standard','Gemini 3.6 Flash',           'tokens','USD',95.66, 1.50, 7.50, 0.150, 1.00, TRUE, NULL,'migration'),
    ('v1','gemini','gemini','gemini-3.5-flash',      NULL,'standard','Gemini 3.5 Flash',           'tokens','USD',95.66, 1.50, 9.00, 0.150, 1.00, TRUE, NULL,'migration'),
    ('v1','gemini','gemini','gemini-3.1-pro-preview',NULL,'standard','Gemini 3.1 Pro Preview',     'tokens','USD',95.66, 2.00,12.00, 0.200, 4.50, TRUE, NULL,'migration'),
    ('v1','gemini','gemini','gemini-3.5-flash-lite', NULL,'standard','Gemini 3.5 Flash-Lite',      'tokens','USD',95.66, 0.30, 2.50, 0.030, 1.00, TRUE, NULL,'migration'),
    ('v1','gemini','gemini','gemini-3.1-flash-lite', NULL,'standard','Gemini 3.1 Flash-Lite',      'tokens','USD',95.66, 0.25, 1.50, 0.025, 1.00, TRUE, NULL,'migration'),
    ('v1','gemini','gemini','gemini-2.5-pro',        NULL,'standard','Gemini 2.5 Pro',             'tokens','USD',95.66, 1.25,10.00, 0.125, 4.50, TRUE, NULL,'migration'),
    ('v1','gemini','gemini','gemini-2.5-flash',      NULL,'standard','Gemini 2.5 Flash',           'tokens','USD',95.66, 0.30, 2.50, 0.030, 1.00, TRUE, 'Legacy engine mis-billed this at Flash-Lite rates (4x under-report)','migration'),
    ('v1','gemini','gemini','gemini-2.5-flash-lite', NULL,'standard','Gemini 2.5 Flash-Lite',      'tokens','USD',95.66, 0.10, 0.40, 0.010, 1.00, TRUE, NULL,'migration'),
    ('v1','gemini','gemini','gemini-2.0-flash',      NULL,'standard','Gemini 2.0 Flash',           'tokens','USD',95.66, 0.10, 0.40, 0.010, 1.00, TRUE, 'Rate recovered from legacy data','migration');

-- 8b. Gemini embeddings (INR-native, carried from legacy: 14.0636 INR / 976,634 tokens)
INSERT INTO citation_rate_card
    (version, provider, service, model, operation, tier, display_name, unit, currency, inr_per_usd,
     input_rate_per_million, is_active, notes, updated_by)
VALUES
    ('v1','gemini','gemini','gemini-embedding-001',NULL,'standard','Gemini Embedding 001','tokens','INR',95.66, 14.40, TRUE,
     'Recovered from legacy data (INR 14.40/M). Not confirmed against a published price list — verify.','migration'),
    ('v1','gemini','gemini','models/gemini-embedding-001',NULL,'standard','Gemini Embedding 001 (prefixed id)','tokens','INR',95.66, 14.40, TRUE,
     'Alias: engine sometimes reports the models/ prefix','migration');

-- 8c. Claude token models (USD per 1M) — recovered exactly: INR 255 / INR 1275 at 85/USD
INSERT INTO citation_rate_card
    (version, provider, service, model, operation, tier, display_name, unit, currency, inr_per_usd,
     input_rate_per_million, output_rate_per_million, is_active, notes, updated_by)
VALUES
    ('v1','claude','claude','claude-sonnet-4-6',NULL,'standard','Claude Sonnet 4.6','tokens','USD',95.66, 3.00, 15.00, TRUE,
     'Recovered exactly from legacy data','migration');

-- 8d. Gemini per-call operations (USD 0.035/call = INR 2.975 — matches legacy exactly)
INSERT INTO citation_rate_card
    (version, provider, service, model, operation, tier, display_name, unit, currency, inr_per_usd,
     flat_rate_per_unit, is_active, notes, updated_by)
VALUES
    ('v1','gemini','gemini',NULL,'grounding',          'standard','Gemini Search Grounding','calls','USD',95.66, 0.035, TRUE,
     'Largest single Gemini cost line in legacy data (63% of Gemini spend)','migration'),
    ('v1','gemini','gemini',NULL,'web_citation_search','standard','Gemini Web Citation Search','calls','USD',95.66, 0.035, TRUE, NULL,'migration');

-- 8e. India Kanoon (INR-native, all verified exactly from legacy data)
INSERT INTO citation_rate_card
    (version, provider, service, model, operation, tier, display_name, unit, currency, inr_per_usd,
     flat_rate_per_unit, is_active, notes, updated_by)
VALUES
    ('v1','indian_kanoon','india_kanoon',NULL,'search',   'standard','India Kanoon — Search',           'calls','INR',95.66, 0.50, TRUE,'Verified: 3019 calls = INR 1509.50','migration'),
    ('v1','indian_kanoon','india_kanoon',NULL,'orig_doc', 'standard','India Kanoon — Original Document','calls','INR',95.66, 0.50, TRUE,'Verified: 908 calls = INR 454.00','migration'),
    ('v1','indian_kanoon','india_kanoon',NULL,'document', 'standard','India Kanoon — Document',         'calls','INR',95.66, 0.20, TRUE,'Verified: 1298 calls = INR 259.60','migration'),
    ('v1','indian_kanoon','india_kanoon',NULL,'fragment', 'standard','India Kanoon — Fragment',         'calls','INR',95.66, 0.05, TRUE,'Verified: 2640 calls = INR 132.00','migration'),
    ('v1','indian_kanoon','india_kanoon',NULL,'meta',     'standard','India Kanoon — Doc Metainfo',     'calls','INR',95.66, 0.02, TRUE,'Verified: 2547 calls = INR 50.94','migration');

-- 8f. Document AI + Serper (INR-native)
INSERT INTO citation_rate_card
    (version, provider, service, model, operation, tier, display_name, unit, currency, inr_per_usd,
     flat_rate_per_unit, is_active, notes, updated_by)
VALUES
    ('v1','document_ai','document_ai',NULL,'ocr',   'standard','Document AI — OCR','pages','INR',95.66, 0.1276, TRUE,'Verified: 50 pages = INR 6.38','migration'),
    ('v1','serper','serper',          NULL,'search','standard','Serper — Search',  'calls','INR',95.66, 0.85,   TRUE,'Verified: 17 calls = INR 14.45','migration');

-- Pin v1 to a fixed start so the effective window also covers backfilled/legacy events
-- (rows default to NOW(), which would exclude anything older than the migration run).
UPDATE citation_rate_card
   SET effective_from = TIMESTAMPTZ '2024-01-01 00:00:00+00'
 WHERE version = 'v1';

RAISE NOTICE 'Rate card v1 seeded.';
END
$seed$;


-- -------------------------------------------------------------------------------------
-- 9. OPERATION ALIASES  —  producer spellings that must not fall through the rate card
-- -------------------------------------------------------------------------------------
-- The engine emits operation='doc' for an India Kanoon document fetch; the rate card was
-- seeded as 'document'. With no match the pricing trigger fell back to the engine's own
-- figure (cost_source='producer'), which bypasses the rate card entirely — repricing IK
-- documents in the admin UI would not have moved those calls, and because the engine
-- reports rupees only, each such row was booked as INR with $0.00.
--
-- Deliberately OUTSIDE the version-guarded seed block above, so it also lands on a DB
-- that was already migrated. Idempotent via NOT EXISTS; the rate is copied from the
-- canonical 'document' row rather than hardcoded, so the two cannot drift apart.
INSERT INTO citation_rate_card
    (version, provider, service, model, operation, tier, display_name, unit, currency,
     inr_per_usd, flat_rate_per_unit, is_active, notes, updated_by, effective_from)
SELECT d.version, d.provider, d.service, NULL, 'doc', d.tier,
       'India Kanoon — Document (engine alias "doc")', d.unit, d.currency,
       d.inr_per_usd, d.flat_rate_per_unit, TRUE,
       'Alias of operation=document — the engine writes "doc"', 'migration',
       TIMESTAMPTZ '2024-01-01 00:00:00+00'
  FROM citation_rate_card d
 WHERE d.provider = 'indian_kanoon'
   AND d.operation = 'document'
   AND d.is_active
   AND NOT EXISTS (
        SELECT 1 FROM citation_rate_card x
         WHERE x.provider = 'indian_kanoon' AND x.operation = 'doc' AND x.is_active
   )
 ORDER BY d.effective_from DESC
 LIMIT 1;
