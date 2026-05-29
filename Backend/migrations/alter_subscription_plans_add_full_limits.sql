-- Add all chat-model and summarization-model limit columns to subscription_plans.
-- These let each plan carry its own per-service rate/quota limits.

ALTER TABLE subscription_plans
  -- Chat Model per-plan limits
  ADD COLUMN IF NOT EXISTS chat_messages_per_hour       INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS chat_chats_per_day           INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS chat_quota_per_minute        INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS chat_max_document_pages      INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS chat_max_document_size_mb    INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS chat_max_file_upload_per_day INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS chat_max_upload_files        INTEGER DEFAULT NULL,

  -- Summarization per-plan limits
  ADD COLUMN IF NOT EXISTS sum_messages_per_hour        INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sum_chats_per_day            INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sum_quota_per_minute         INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sum_max_document_pages       INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sum_max_document_size_mb     INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sum_max_file_upload_per_day  INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sum_max_upload_files         INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sum_max_context_documents    INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS sum_max_conversation_history INTEGER DEFAULT NULL;
