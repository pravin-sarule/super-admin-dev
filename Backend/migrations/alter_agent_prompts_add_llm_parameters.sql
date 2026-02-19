-- Add llm_parameters column to agent_prompts (Draft_DB) if it does not exist.
-- Run this on the Draft_DB database. Safe to run multiple times: only adds the column when missing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agent_prompts'
      AND column_name = 'llm_parameters'
  ) THEN
    ALTER TABLE agent_prompts
    ADD COLUMN llm_parameters JSONB DEFAULT '{}';
    RAISE NOTICE 'Column agent_prompts.llm_parameters added.';
  ELSE
    RAISE NOTICE 'Column agent_prompts.llm_parameters already exists.';
  END IF;
END $$;
