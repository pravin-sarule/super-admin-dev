-- Migration: Add role and user assignment columns to system_prompts (docDB)

ALTER TABLE system_prompts
  ADD COLUMN IF NOT EXISTS assigned_role_ids INTEGER[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS assigned_user_ids INTEGER[] DEFAULT '{}';

COMMENT ON COLUMN system_prompts.assigned_role_ids IS 'IDs from prompt_roles table assigned to this prompt';
COMMENT ON COLUMN system_prompts.assigned_user_ids IS 'Individual user IDs from main users table (solo user assignment)';
