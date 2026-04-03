-- Fix custom_query.id: ensure it has a default so INSERT without id works.
-- Run this against the same DB as DOCDB_URL (docDB) if you get:
--   null value in column "id" of relation "custom_query" violates not-null constraint

-- Create sequence if missing
CREATE SEQUENCE IF NOT EXISTS custom_query_id_seq;

-- Sync sequence with current max id so next insert gets a valid id
SELECT setval('custom_query_id_seq', COALESCE((SELECT MAX(id) FROM custom_query), 0));

-- Set default for id column
ALTER TABLE custom_query ALTER COLUMN id SET DEFAULT nextval('custom_query_id_seq'::regclass);
