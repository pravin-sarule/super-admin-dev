-- Extend citation_service_usage to match live ingestion (username, used_at, usage_time_ms).
-- Run on the Citation DB if columns are missing. Safe to re-run (IF NOT EXISTS).

ALTER TABLE citation_service_usage
  ADD COLUMN IF NOT EXISTS username VARCHAR(128),
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS usage_time_ms INTEGER;

-- Older installs already have created_at; custom schemas may only have used_at — add created_at for COALESCE(used_at, created_at) in analytics.
ALTER TABLE citation_service_usage
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill used_at from created_at where missing (optional one-time fix)
-- UPDATE citation_service_usage SET used_at = created_at WHERE used_at IS NULL AND created_at IS NOT NULL;
