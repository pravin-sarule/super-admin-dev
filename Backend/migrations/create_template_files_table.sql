-- =====================================================
-- MIGRATION: Create template_files table
-- =====================================================
-- IMPORTANT: Run this on docDB (DOCDB_URL), not the main database
-- This migration creates the template_files table and updates secret_manager table

DO $$
BEGIN
  RAISE NOTICE '🚀 Starting migration...';
  
  -- Step 1: Add columns to secret_manager if they don't exist
  BEGIN
    ALTER TABLE secret_manager ADD COLUMN IF NOT EXISTS llm_id INTEGER;
    ALTER TABLE secret_manager ADD COLUMN IF NOT EXISTS chunking_method_id INTEGER;
    ALTER TABLE secret_manager ADD COLUMN IF NOT EXISTS temperature DECIMAL(3,2);
    ALTER TABLE secret_manager ADD COLUMN IF NOT EXISTS input_template_id UUID;
    ALTER TABLE secret_manager ADD COLUMN IF NOT EXISTS output_template_id UUID;
    ALTER TABLE secret_manager ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
    RAISE NOTICE '✅ Step 1: Columns added to secret_manager';
  EXCEPTION
    WHEN duplicate_column THEN
      RAISE NOTICE 'ℹ️  Columns already exist, skipping...';
  END;
  
  -- Step 2: Create template_files table
  CREATE TABLE IF NOT EXISTS template_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('input', 'output')),
    mime_type VARCHAR(100) DEFAULT 'application/pdf',
    file_extension VARCHAR(10) DEFAULT 'pdf',
    bucket_name VARCHAR(255) NOT NULL DEFAULT 'legal-templates-bucket',
    bucket_path VARCHAR(500) NOT NULL,
    bucket_region VARCHAR(50) DEFAULT 'asia-south1',
    file_size BIGINT,
    file_hash VARCHAR(64),
    page_count INTEGER,
    signed_url TEXT,
    signed_url_expires_at TIMESTAMP,
    signed_url_expiry_minutes INTEGER DEFAULT 60,
    ai_processed BOOLEAN DEFAULT FALSE,
    ai_processing_date TIMESTAMP,
    ai_confidence_score DECIMAL(5,4),
    ai_extracted_text TEXT,
    ai_form_fields_count INTEGER DEFAULT 0,
    ai_tables_count INTEGER DEFAULT 0,
    template_metadata JSONB DEFAULT '{}'::jsonb,
    version VARCHAR(50) DEFAULT '1.0',
    is_latest_version BOOLEAN DEFAULT TRUE,
    parent_file_id UUID,
    secret_manager_id UUID NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deleted', 'processing', 'failed')),
    created_by INTEGER NOT NULL,
    updated_by INTEGER,
    uploaded_by INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    uploaded_at TIMESTAMP DEFAULT NOW(),
    deleted_at TIMESTAMP,
    CONSTRAINT fk_template_secret_manager 
      FOREIGN KEY (secret_manager_id) 
      REFERENCES secret_manager(id) 
      ON DELETE CASCADE,
    CONSTRAINT fk_template_parent_file 
      FOREIGN KEY (parent_file_id) 
      REFERENCES template_files(id) 
      ON DELETE SET NULL,
    CONSTRAINT unique_template_bucket_path 
      UNIQUE(bucket_name, bucket_path)
  );
  RAISE NOTICE '✅ Step 2: template_files table created';
  
  -- Step 3: Create indexes
  CREATE INDEX IF NOT EXISTS idx_template_files_secret_id ON template_files(secret_manager_id);
  CREATE INDEX IF NOT EXISTS idx_template_files_type ON template_files(file_type);
  CREATE INDEX IF NOT EXISTS idx_template_files_status ON template_files(status);
  CREATE INDEX IF NOT EXISTS idx_template_files_bucket_path ON template_files(bucket_path);
  CREATE INDEX IF NOT EXISTS idx_template_files_filename ON template_files(filename);
  CREATE INDEX IF NOT EXISTS idx_template_files_metadata ON template_files USING gin(template_metadata);
  CREATE INDEX IF NOT EXISTS idx_secret_manager_llm_id ON secret_manager(llm_id);
  CREATE INDEX IF NOT EXISTS idx_secret_manager_chunking_method ON secret_manager(chunking_method_id);
  CREATE INDEX IF NOT EXISTS idx_secret_manager_input_template ON secret_manager(input_template_id);
  CREATE INDEX IF NOT EXISTS idx_secret_manager_output_template ON secret_manager(output_template_id);
  RAISE NOTICE '✅ Step 3: Indexes created';
  
  -- Step 4: Add foreign keys (with existence check)
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_sm_input_template' 
    AND table_name = 'secret_manager'
  ) THEN
    ALTER TABLE secret_manager
    ADD CONSTRAINT fk_sm_input_template 
      FOREIGN KEY (input_template_id) 
      REFERENCES template_files(id) 
      ON DELETE SET NULL;
    RAISE NOTICE '✅ Foreign key fk_sm_input_template added';
  ELSE
    RAISE NOTICE 'ℹ️  Foreign key fk_sm_input_template already exists';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_sm_output_template' 
    AND table_name = 'secret_manager'
  ) THEN
    ALTER TABLE secret_manager
    ADD CONSTRAINT fk_sm_output_template 
      FOREIGN KEY (output_template_id) 
      REFERENCES template_files(id) 
      ON DELETE SET NULL;
    RAISE NOTICE '✅ Foreign key fk_sm_output_template added';
  ELSE
    RAISE NOTICE 'ℹ️  Foreign key fk_sm_output_template already exists';
  END IF;
  
  RAISE NOTICE '✅ Step 4: Foreign keys configured';
  RAISE NOTICE '🎉 Migration completed successfully!';
  
END $$;

-- Final verification
SELECT '🎉 MIGRATION COMPLETE!' as status;
SELECT COUNT(*) as existing_secrets FROM secret_manager;
SELECT COUNT(*) as template_files_count FROM template_files;

-- Show updated structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns
WHERE table_name = 'secret_manager'
ORDER BY ordinal_position;

