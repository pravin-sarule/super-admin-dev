-- Fix llm_models.id: ensure it has a default so INSERT without id works.
-- Run this against the same DB as DOCDB_URL (docDB) if you get:
--   null value in column "id" of relation "llm_models" violates not-null constraint

-- Create sequence if missing
CREATE SEQUENCE IF NOT EXISTS llm_models_id_seq;

-- Sync sequence with current max id so next insert gets a valid id
SELECT setval('llm_models_id_seq', COALESCE((SELECT MAX(id) FROM llm_models), 0));

-- Set default for id column
ALTER TABLE llm_models ALTER COLUMN id SET DEFAULT nextval('llm_models_id_seq'::regclass);
