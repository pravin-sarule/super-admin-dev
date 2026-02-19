-- =====================================================
-- Add user_id to templates table (draftDB)
-- Admin-added templates: user_id IS NULL
-- User-added templates: user_id = <user's id>
-- =====================================================

DO $$
BEGIN
  BEGIN
    ALTER TABLE templates ADD COLUMN IF NOT EXISTS user_id INTEGER;
    RAISE NOTICE '✅ user_id column added to templates';
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'ℹ️ user_id column already exists';
  END;
  CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
END $$;
