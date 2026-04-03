-- docDB: repair system_prompts.id when the column has no DEFAULT (inserts fail with null id).
-- Safe to run multiple times.

DO $$
DECLARE
  col_default text;
  id_identity text;
BEGIN
  SELECT c.column_default, c.is_identity INTO col_default, id_identity
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'system_prompts'
    AND c.column_name = 'id';

  IF col_default IS NULL AND COALESCE(id_identity, 'NO') <> 'YES' THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_class rel
      JOIN pg_namespace n ON n.oid = rel.relnamespace
      WHERE rel.relkind = 'S' AND rel.relname = 'system_prompts_id_seq' AND n.nspname = 'public'
    ) THEN
      CREATE SEQUENCE public.system_prompts_id_seq;
    END IF;
    IF (SELECT COALESCE(MAX(id), 0) FROM public.system_prompts) = 0 THEN
      PERFORM setval('public.system_prompts_id_seq', 1, false);
    ELSE
      PERFORM setval(
        'public.system_prompts_id_seq',
        (SELECT MAX(id) FROM public.system_prompts)
      );
    END IF;
    ALTER TABLE public.system_prompts
      ALTER COLUMN id SET DEFAULT nextval('public.system_prompts_id_seq'::regclass);
    -- Skip OWNED BY: same-owner as table is required; DEFAULT nextval is sufficient for new ids
  END IF;
END $$;
