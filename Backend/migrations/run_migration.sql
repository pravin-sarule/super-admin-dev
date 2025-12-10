-- Run this SQL script directly on your docDB database (the one connected via DOCDB_URL)
-- This will create the system_prompts table if it doesn't exist

-- Drop table if you need to recreate it (uncomment if needed)
-- DROP TABLE IF EXISTS system_prompts CASCADE;

-- Create the system_prompts table
CREATE TABLE IF NOT EXISTS system_prompts (
    id SERIAL PRIMARY KEY,
    system_prompt TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_system_prompts_created_at 
ON system_prompts(created_at DESC);

-- Verify the table was created
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'system_prompts'
ORDER BY ordinal_position;

