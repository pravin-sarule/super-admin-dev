const pool = require('../config/db');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Schema');

async function initializeSchema() {
  logger.step('Initializing database schema');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS judgments (
      judgment_uuid UUID PRIMARY KEY,
      canonical_id VARCHAR(200) UNIQUE NOT NULL,
      case_name TEXT NOT NULL,
      court_code VARCHAR(20) NOT NULL DEFAULT 'UNKNOWN',
      court_tier VARCHAR(10),
      judgment_date DATE,
      year SMALLINT,
      doc_type VARCHAR(20) DEFAULT 'judgment',
      outcome VARCHAR(50),
      bench_size SMALLINT,
      bench_type VARCHAR(20),
      source_type VARCHAR(20),
      verification_status VARCHAR(20),
      confidence_score DECIMAL(4,3),
      citation_frequency INT DEFAULT 0,
      qdrant_vector_id BIGINT,
      neo4j_node_id BIGINT,
      es_doc_id TEXT,
      citation_data JSONB DEFAULT '{}'::jsonb,
      status VARCHAR(40) DEFAULT 'uploaded',
      ocr_info JSONB DEFAULT '{}'::jsonb,
      qdrant_collection VARCHAR(100),
      ingested_at TIMESTAMPTZ DEFAULT NOW(),
      last_verified_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS citation_aliases (
      alias_id UUID PRIMARY KEY,
      judgment_uuid UUID REFERENCES judgments(judgment_uuid) ON DELETE CASCADE,
      alias_string VARCHAR(300) NOT NULL,
      reporter_type VARCHAR(50),
      normalized VARCHAR(300) UNIQUE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS judges (
      judge_id BIGSERIAL PRIMARY KEY,
      canonical_name VARCHAR(500) UNIQUE NOT NULL,
      honorific VARCHAR(50),
      name_variants TEXT[],
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS judgment_judges (
      judgment_uuid UUID REFERENCES judgments(judgment_uuid) ON DELETE CASCADE,
      judge_id BIGINT REFERENCES judges(judge_id) ON DELETE CASCADE,
      role VARCHAR(50),
      PRIMARY KEY (judgment_uuid, judge_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS statutes_cited (
      statute_id BIGSERIAL PRIMARY KEY,
      judgment_uuid UUID REFERENCES judgments(judgment_uuid) ON DELETE CASCADE,
      act_name VARCHAR(500),
      act_short VARCHAR(100),
      section VARCHAR(50),
      sub_section VARCHAR(50),
      india_code_url TEXT
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS judgment_uploads (
      document_id UUID PRIMARY KEY,
      judgment_uuid UUID REFERENCES judgments(judgment_uuid) ON DELETE SET NULL,
      canonical_id VARCHAR(200),
      original_filename TEXT NOT NULL,
      source_url TEXT,
      storage_bucket TEXT,
      storage_path TEXT,
      storage_uri TEXT,
      status VARCHAR(40) NOT NULL DEFAULT 'uploaded',
      admin_user_id INTEGER,
      admin_role TEXT,
      total_pages INTEGER DEFAULT 0,
      text_pages_count INTEGER DEFAULT 0,
      ocr_pages_count INTEGER DEFAULT 0,
      ocr_batches_count INTEGER DEFAULT 0,
      merged_text TEXT,
      metadata JSONB DEFAULT '{}'::jsonb,
      pipeline_metrics JSONB DEFAULT '{}'::jsonb,
      es_doc_id TEXT,
      qdrant_collection VARCHAR(100),
      last_progress_message TEXT,
      error_message TEXT,
      processing_started_at TIMESTAMPTZ,
      processing_completed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS judgment_pages (
      page_id UUID PRIMARY KEY,
      document_id UUID REFERENCES judgment_uploads(document_id) ON DELETE CASCADE,
      page_number INTEGER NOT NULL,
      page_type VARCHAR(20) NOT NULL,
      status VARCHAR(40) NOT NULL DEFAULT 'uploaded',
      text_length INTEGER DEFAULT 0,
      text_content TEXT,
      gcs_page_path TEXT,
      gcs_page_uri TEXT,
      ocr_json_path TEXT,
      ocr_json_uri TEXT,
      ocr_confidence NUMERIC(5,4),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (document_id, page_number)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS judgment_chunks (
      chunk_id UUID PRIMARY KEY,
      document_id UUID REFERENCES judgment_uploads(document_id) ON DELETE CASCADE,
      judgment_uuid UUID REFERENCES judgments(judgment_uuid) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      char_start INTEGER NOT NULL,
      char_end INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding_model TEXT,
      embedding_status VARCHAR(40) DEFAULT 'pending',
      qdrant_point_id VARCHAR(100),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (judgment_uuid, chunk_index)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_judgment_uploads_status_created_at
    ON judgment_uploads (status, created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_judgment_pages_document_page
    ON judgment_pages (document_id, page_number);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_judgment_chunks_judgment_uuid
    ON judgment_chunks (judgment_uuid, chunk_index);
  `);

  // Backfill columns for databases created from older schema versions.
  await pool.query(`
    ALTER TABLE judgments
    ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'uploaded';
  `);

  await pool.query(`
    ALTER TABLE judgments
    ADD COLUMN IF NOT EXISTS citation_data JSONB DEFAULT '{}'::jsonb;
  `);

  await pool.query(`
    ALTER TABLE judgments
    ADD COLUMN IF NOT EXISTS ocr_info JSONB DEFAULT '{}'::jsonb;
  `);

  await pool.query(`
    ALTER TABLE judgments
    ADD COLUMN IF NOT EXISTS qdrant_collection VARCHAR(100);
  `);

  await pool.query(`
    ALTER TABLE judgments
    ALTER COLUMN es_doc_id TYPE TEXT;
  `);

  await pool.query(`
    ALTER TABLE judgment_uploads
    ADD COLUMN IF NOT EXISTS error_message TEXT;
  `);

  await pool.query(`
    ALTER TABLE judgment_uploads
    ADD COLUMN IF NOT EXISTS last_progress_message TEXT;
  `);

  await pool.query(`
    ALTER TABLE judgment_uploads
    ADD COLUMN IF NOT EXISTS pipeline_metrics JSONB DEFAULT '{}'::jsonb;
  `);

  await pool.query(`
    ALTER TABLE judgment_uploads
    ALTER COLUMN es_doc_id TYPE TEXT;
  `);

  logger.info('Database schema ready');
}

module.exports = initializeSchema;
