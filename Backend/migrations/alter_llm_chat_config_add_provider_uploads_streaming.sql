-- Run against docDB if llm_chat_config exists without newer columns.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'llm_chat_config') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'llm_chat_config' AND column_name = 'llm_provider') THEN
      ALTER TABLE llm_chat_config ADD COLUMN llm_provider VARCHAR(100) DEFAULT 'google';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'llm_chat_config' AND column_name = 'max_upload_files') THEN
      ALTER TABLE llm_chat_config ADD COLUMN max_upload_files INT DEFAULT 8;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'llm_chat_config' AND column_name = 'streaming_delay') THEN
      ALTER TABLE llm_chat_config ADD COLUMN streaming_delay INT DEFAULT 100;
    END IF;
  END IF;
END $$;
