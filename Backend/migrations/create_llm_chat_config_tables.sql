-- Create llm_chat_config table in docDB
-- Single-row config table admin controls for chat LLM settings
CREATE TABLE IF NOT EXISTS llm_chat_config (
  id SERIAL PRIMARY KEY,
  max_output_tokens INT DEFAULT 20000,
  total_tokens_per_day INT DEFAULT 250000,
  llm_model VARCHAR(100) DEFAULT 'gemini-2.5-flash-lite',
  llm_provider VARCHAR(100) DEFAULT 'google',
  model_temperature DECIMAL(3,2) DEFAULT 0.7,
  messages_per_hour INT DEFAULT 50,
  quota_chats_per_minute INT DEFAULT 10,
  chats_per_day INT DEFAULT 60,
  max_document_pages INT DEFAULT 300,
  max_document_size_mb INT DEFAULT 40,
  max_file_upload_per_day INT DEFAULT 15,
  max_upload_files INT DEFAULT 8,
  streaming_delay INT DEFAULT 100,
  updated_by INT DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default row only if table is empty
INSERT INTO llm_chat_config (
  max_output_tokens, total_tokens_per_day, llm_model, llm_provider, model_temperature,
  messages_per_hour, quota_chats_per_minute, chats_per_day,
  max_document_pages, max_document_size_mb, max_file_upload_per_day,
  max_upload_files, streaming_delay
)
SELECT
  20000, 250000, 'gemini-2.5-flash-lite', 'google', 0.7,
  50, 10, 60, 300, 40, 15, 8, 100
WHERE NOT EXISTS (SELECT 1 FROM llm_chat_config);

-- Create user_llm_usage table in main DB (run separately against main DB)
-- Tracks per-user daily usage for rate limiting enforcement
CREATE TABLE IF NOT EXISTS user_llm_usage (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  tokens_used INT DEFAULT 0,
  messages_sent INT DEFAULT 0,
  chats_today INT DEFAULT 0,
  files_uploaded_today INT DEFAULT 0,
  last_message_at TIMESTAMP DEFAULT NULL,
  usage_date DATE DEFAULT CURRENT_DATE,
  UNIQUE(user_id, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_user_llm_usage_user_date ON user_llm_usage(user_id, usage_date);
