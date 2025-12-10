-- =====================================================
-- MIGRATION: Add structured_schema column to document_ai_extractions
-- =====================================================
-- This migration adds a column to store clean, structured JSON schema
-- formatted for LLM consumption with markdown

DO $$
BEGIN
  RAISE NOTICE '🚀 Starting structured_schema column migration...';
  
  -- Check if column already exists
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'document_ai_extractions' 
    AND column_name = 'structured_schema'
  ) THEN
    -- Add structured_schema column
    ALTER TABLE document_ai_extractions
    ADD COLUMN structured_schema JSONB DEFAULT NULL;
    
    -- Add comment
    COMMENT ON COLUMN document_ai_extractions.structured_schema IS 
      'Structured JSON schema formatted for LLM consumption with markdown, containing clean extracted data in legal summary format';
    
    -- Create GIN index for efficient JSONB queries
    CREATE INDEX IF NOT EXISTS idx_document_ai_structured_schema_gin 
    ON document_ai_extractions USING gin(structured_schema);
    
    RAISE NOTICE '✅ structured_schema column added successfully';
  ELSE
    RAISE NOTICE '✅ structured_schema column already exists';
  END IF;
  
  RAISE NOTICE '🎉 structured_schema column migration completed successfully!';
  
END $$;



