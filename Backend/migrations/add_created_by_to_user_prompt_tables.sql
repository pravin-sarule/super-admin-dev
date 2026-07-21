-- Migration: track who created a user preset prompt / group.
-- Target DB: Document_DB (DOCDB_URL) — shared with the document/chat service.
--
-- Additive and reversible. Existing rows and any INSERT from the document service
-- (which does not know about these columns) fall back to 'user', which is correct:
-- everything that existed before this migration was created by the end user.
--
-- created_by          : 'user' | 'superadmin'
-- created_by_admin_id : super_admins.id from the main Auth_DB when created_by='superadmin'.
--                       Not an FK — super_admins lives in a different database.

ALTER TABLE user_prompt_groups
  ADD COLUMN IF NOT EXISTS created_by          TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS created_by_admin_id INTEGER;

ALTER TABLE user_custom_prompts
  ADD COLUMN IF NOT EXISTS created_by          TEXT NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS created_by_admin_id INTEGER;

ALTER TABLE user_prompt_groups DROP CONSTRAINT IF EXISTS user_prompt_groups_created_by_check;
ALTER TABLE user_prompt_groups
  ADD CONSTRAINT user_prompt_groups_created_by_check CHECK (created_by IN ('user', 'superadmin'));

ALTER TABLE user_custom_prompts DROP CONSTRAINT IF EXISTS user_custom_prompts_created_by_check;
ALTER TABLE user_custom_prompts
  ADD CONSTRAINT user_custom_prompts_created_by_check CHECK (created_by IN ('user', 'superadmin'));

-- Rollback:
--   ALTER TABLE user_prompt_groups  DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS created_by_admin_id;
--   ALTER TABLE user_custom_prompts DROP COLUMN IF EXISTS created_by, DROP COLUMN IF EXISTS created_by_admin_id;
