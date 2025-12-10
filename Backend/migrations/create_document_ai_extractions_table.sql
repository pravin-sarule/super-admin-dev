-- =====================================================
-- MIGRATION: Create document_ai_extractions table
-- =====================================================
-- IMPORTANT: Run this on docDB (DOCDB_URL), not the main database
-- This table stores text extracted from PDFs using Google Cloud Document AI

DO $$
BEGIN
  RAISE NOTICE '🚀 Starting document_ai_extractions table migration...';
  
  -- Create document_ai_extractions table
  CREATE TABLE IF NOT EXISTS document_ai_extractions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Reference to the template file
    template_file_id UUID NOT NULL,
    
    -- File type (input or output)
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('input', 'output')),
    
    -- Document AI processing information
    document_ai_processor_id VARCHAR(255),
    document_ai_processor_version VARCHAR(100),
    document_ai_operation_name VARCHAR(500),
    document_ai_request_id VARCHAR(255),
    
    -- Extracted content
    extracted_text TEXT NOT NULL,
    extracted_text_hash VARCHAR(64), -- SHA-256 hash for deduplication
    
    -- Document structure information
    page_count INTEGER,
    total_characters INTEGER,
    total_words INTEGER,
    total_paragraphs INTEGER,
    
    -- Document AI entities (stored as JSONB for flexibility)
    entities JSONB DEFAULT '[]'::jsonb,
    form_fields JSONB DEFAULT '[]'::jsonb,
    tables JSONB DEFAULT '[]'::jsonb,
    
    -- Confidence scores
    confidence_score DECIMAL(5,4), -- Overall confidence (0.0 to 1.0)
    average_confidence DECIMAL(5,4),
    min_confidence DECIMAL(5,4),
    max_confidence DECIMAL(5,4),
    
    -- Processing metadata
    processing_status VARCHAR(50) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    processing_error TEXT,
    processing_duration_ms INTEGER,
    
    -- Document AI raw response (text only, not full JSON)
    raw_response TEXT,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT fk_extraction_template_file 
      FOREIGN KEY (template_file_id) 
      REFERENCES template_files(id) 
      ON DELETE CASCADE
  );
  
  RAISE NOTICE '✅ document_ai_extractions table created';
  
  -- Create indexes for better query performance
  CREATE INDEX IF NOT EXISTS idx_extractions_template_file_id ON document_ai_extractions(template_file_id);
  CREATE INDEX IF NOT EXISTS idx_extractions_file_type ON document_ai_extractions(file_type);
  CREATE INDEX IF NOT EXISTS idx_extractions_status ON document_ai_extractions(processing_status);
  CREATE INDEX IF NOT EXISTS idx_extractions_processed_at ON document_ai_extractions(processed_at DESC);
  CREATE INDEX IF NOT EXISTS idx_extractions_text_hash ON document_ai_extractions(extracted_text_hash);
  CREATE INDEX IF NOT EXISTS idx_extractions_metadata ON document_ai_extractions USING gin(metadata);
  CREATE INDEX IF NOT EXISTS idx_extractions_entities ON document_ai_extractions USING gin(entities);
  CREATE INDEX IF NOT EXISTS idx_extractions_form_fields ON document_ai_extractions USING gin(form_fields);
  CREATE INDEX IF NOT EXISTS idx_extractions_tables ON document_ai_extractions USING gin(tables);
  
  RAISE NOTICE '✅ Indexes created';
  
  -- Add comment to table
  COMMENT ON TABLE document_ai_extractions IS 'Stores text and structured data extracted from PDFs using Google Cloud Document AI';
  COMMENT ON COLUMN document_ai_extractions.extracted_text IS 'Full text content extracted from the document';
  COMMENT ON COLUMN document_ai_extractions.extracted_text_hash IS 'SHA-256 hash of extracted text for deduplication';
  COMMENT ON COLUMN document_ai_extractions.entities IS 'Document AI detected entities (names, dates, addresses, etc.)';
  COMMENT ON COLUMN document_ai_extractions.form_fields IS 'Form fields detected in the document';
  COMMENT ON COLUMN document_ai_extractions.tables IS 'Tables extracted from the document';
  COMMENT ON COLUMN document_ai_extractions.raw_response IS 'Complete Document AI API response for reference';
  
  RAISE NOTICE '🎉 Migration completed successfully!';
  
END $$;

-- Final verification
SELECT '🎉 MIGRATION COMPLETE!' as status;
SELECT COUNT(*) as existing_extractions FROM document_ai_extractions;

-- Show table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'document_ai_extractions'
ORDER BY ordinal_position;

