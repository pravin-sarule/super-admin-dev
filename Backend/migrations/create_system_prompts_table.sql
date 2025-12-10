-- Migration: Create system_prompts table
-- This table stores system prompts that can be managed by super-admin
-- IMPORTANT: Run this on docDB (DOCDB_URL), not the main database

CREATE TABLE IF NOT EXISTS system_prompts (
    id SERIAL PRIMARY KEY,
    system_prompt TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on created_at for faster sorting
CREATE INDEX IF NOT EXISTS idx_system_prompts_created_at ON system_prompts(created_at DESC);

-- Add comment to table
COMMENT ON TABLE system_prompts IS 'Stores system prompts managed by super-admin';

