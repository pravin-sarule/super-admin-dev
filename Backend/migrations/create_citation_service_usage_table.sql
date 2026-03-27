-- Citation Service Usage table (Citation DB)
-- Run this on the Citation database if the table does not exist.

CREATE TABLE IF NOT EXISTS citation_service_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID,
    user_id VARCHAR NOT NULL,
    username VARCHAR(128),
    service VARCHAR(64) NOT NULL,
    operation VARCHAR(64),
    quantity INTEGER NOT NULL DEFAULT 0,
    unit VARCHAR(32) DEFAULT 'calls',
    cost_inr NUMERIC(12,4) DEFAULT 0,
    cost_usd NUMERIC(12,6) DEFAULT 0,
    usage_time_ms INTEGER,
    metadata JSONB,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_citation_usage_run ON citation_service_usage(run_id);
CREATE INDEX IF NOT EXISTS idx_citation_usage_user ON citation_service_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_citation_usage_service ON citation_service_usage(service);
CREATE INDEX IF NOT EXISTS idx_citation_usage_created ON citation_service_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_citation_usage_user_created ON citation_service_usage(user_id, created_at DESC);
