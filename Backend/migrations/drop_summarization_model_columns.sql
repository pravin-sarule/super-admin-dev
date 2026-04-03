-- Run on docDB if upgrading an older DB that still has these columns.
ALTER TABLE summarization_chat_config
  DROP COLUMN IF EXISTS summarization_model,
  DROP COLUMN IF EXISTS max_summarization_output_tokens;
