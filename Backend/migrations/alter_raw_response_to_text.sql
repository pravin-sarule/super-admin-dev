-- =====================================================
-- MIGRATION: Alter raw_response column from JSONB to TEXT
-- =====================================================
-- This migration changes the raw_response column in document_ai_extractions
-- from JSONB to TEXT to store only the extracted text, not the full JSON response

DO $$
DECLARE
  col_type text;
BEGIN
  RAISE NOTICE '🚀 Starting raw_response column type migration...';
  
  -- Check column type
  SELECT data_type INTO col_type
  FROM information_schema.columns 
  WHERE table_name = 'document_ai_extractions' 
  AND column_name = 'raw_response';
  
  IF col_type IS NULL THEN
    RAISE NOTICE '⚠️  raw_response column does not exist';
    RETURN;
  END IF;
  
  IF col_type = 'text' THEN
    RAISE NOTICE '✅ raw_response column is already TEXT type';
    RETURN;
  END IF;
  
  IF col_type = 'jsonb' THEN
    RAISE NOTICE '📝 Converting JSONB column to TEXT...';
    
    -- First, create a temporary column to store the text
    ALTER TABLE document_ai_extractions
    ADD COLUMN IF NOT EXISTS raw_response_temp TEXT;
    
    -- Extract text from JSONB and store in temp column
    UPDATE document_ai_extractions
    SET raw_response_temp = CASE
      WHEN raw_response IS NULL THEN ''
      WHEN raw_response::text LIKE '%"text"%' THEN
        -- Try to extract text from JSON structure
        COALESCE(
          (raw_response->'document'->>'text'),
          (raw_response->>'text'),
          raw_response::text
        )
      ELSE
        raw_response::text
    END;
    
    -- Drop the old JSONB column
    ALTER TABLE document_ai_extractions
    DROP COLUMN raw_response;
    
    -- Rename temp column to original name
    ALTER TABLE document_ai_extractions
    RENAME COLUMN raw_response_temp TO raw_response;
    
    RAISE NOTICE '✅ raw_response column converted from JSONB to TEXT';
  ELSE
    RAISE NOTICE '⚠️  raw_response column has unexpected type: %', col_type;
  END IF;
  
  RAISE NOTICE '🎉 raw_response column type migration completed successfully!';
  
END $$;

