-- New simplified plan catalog (Payment DB).
-- Coexists with the legacy `subscription_plans` table — nothing here touches it.
--
--   monthly_plans : recurring plans. Grant `monthly_tokens` each cycle, throttled by `daily_token_limit`.
--   topup_plans   : one-time token packs. Grant `tokens` with a fixed `validity_days` (expiry).
--
-- Token model: a single unified token pool per user.
--   • Monthly tokens ARE subject to the daily cap.
--   • Topup credits are NOT subject to any daily cap — spent anytime until they expire.

CREATE TABLE IF NOT EXISTS monthly_plans (
    id                      SERIAL PRIMARY KEY,
    name                    VARCHAR(100) NOT NULL UNIQUE,
    description             TEXT,
    price                   NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency                VARCHAR(3)    NOT NULL DEFAULT 'INR',
    monthly_tokens          BIGINT        NOT NULL DEFAULT 0,   -- tokens granted per month
    daily_token_limit       BIGINT,                             -- per-day cap on monthly tokens (NULL = unlimited)
    billing_interval_months INTEGER       NOT NULL DEFAULT 1,   -- 1=monthly, 3=quarterly, 6=half-yearly, 12=yearly
    category                VARCHAR(20)   NOT NULL DEFAULT 'solo', -- audience: 'solo' or 'firm'
    is_custom               BOOLEAN       NOT NULL DEFAULT FALSE,  -- true = "Contact us" card (no fixed price/tokens)
    storage_limit_gb        INTEGER,                              -- storage cap in GB (NULL = no cap / custom). 1024 = 1 TB
    is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order              INTEGER       NOT NULL DEFAULT 0,
    razorpay_plan_id        VARCHAR(120),
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Patch already-created tables (idempotent):
ALTER TABLE monthly_plans ADD COLUMN IF NOT EXISTS billing_interval_months INTEGER NOT NULL DEFAULT 1;
ALTER TABLE monthly_plans ADD COLUMN IF NOT EXISTS category  VARCHAR(20) NOT NULL DEFAULT 'solo';
ALTER TABLE monthly_plans ADD COLUMN IF NOT EXISTS is_custom BOOLEAN     NOT NULL DEFAULT FALSE;
ALTER TABLE monthly_plans ADD COLUMN IF NOT EXISTS storage_limit_gb INTEGER;

CREATE TABLE IF NOT EXISTS topup_plans (
    id                SERIAL PRIMARY KEY,
    name              VARCHAR(100) NOT NULL UNIQUE,
    description       TEXT,
    price             NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency          VARCHAR(3)    NOT NULL DEFAULT 'INR',
    tokens            BIGINT        NOT NULL DEFAULT 0,    -- tokens granted on purchase
    validity_days     INTEGER       NOT NULL DEFAULT 30,   -- fixed presets, expiry = purchase + N days. Convention: 1 month=30d, 1 year=360d (e.g. 6mo=180, 12yr=4320)
    is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order        INTEGER       NOT NULL DEFAULT 0,
    razorpay_plan_id  VARCHAR(120),
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Add-on plans (storage for now). Recurring or one-time-permanent. No tokens.
CREATE TABLE IF NOT EXISTS addon_plans (
    id                      SERIAL PRIMARY KEY,
    name                    VARCHAR(100) NOT NULL UNIQUE,
    description             TEXT,
    addon_type              VARCHAR(20)   NOT NULL DEFAULT 'storage', -- 'storage' for now; room for future add-on types
    price                   NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency                VARCHAR(3)    NOT NULL DEFAULT 'INR',
    storage_gb              INTEGER       NOT NULL DEFAULT 0,           -- extra storage granted (1..1024+; 1024 = 1 TB)
    billing_type            VARCHAR(20)   NOT NULL DEFAULT 'recurring', -- 'recurring' | 'one_time'
    billing_interval_months INTEGER,                                   -- used when recurring (1/3/6/12); NULL for one-time
    validity_years          INTEGER,                                   -- used when one_time (e.g. 10/15 yr term, then renew); NULL for recurring
    is_active               BOOLEAN       NOT NULL DEFAULT TRUE,
    sort_order              INTEGER       NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Patch already-created addon_plans (idempotent):
ALTER TABLE addon_plans ADD COLUMN IF NOT EXISTS validity_years INTEGER;

CREATE INDEX IF NOT EXISTS idx_monthly_plans_active ON monthly_plans (is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_topup_plans_active   ON topup_plans   (is_active, sort_order);
CREATE INDEX IF NOT EXISTS idx_addon_plans_active   ON addon_plans   (is_active, sort_order);
