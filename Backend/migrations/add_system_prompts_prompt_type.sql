-- Run on docDB (DOCDB_URL). Adds service type for chat vs summarization (one row each).

ALTER TABLE system_prompts
ADD COLUMN IF NOT EXISTS prompt_type VARCHAR(32) NOT NULL DEFAULT 'general';

CREATE UNIQUE INDEX IF NOT EXISTS idx_system_prompts_service_type
ON system_prompts (prompt_type)
WHERE prompt_type IN ('chat_model', 'summarization');
