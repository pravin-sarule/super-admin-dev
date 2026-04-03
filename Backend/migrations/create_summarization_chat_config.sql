-- Summarization chat singleton config (docDB)
CREATE TABLE IF NOT EXISTS summarization_chat_config (
  id SERIAL PRIMARY KEY,
  llm_model VARCHAR(200) DEFAULT 'gemini-2.5-flash',
  llm_provider VARCHAR(100) DEFAULT 'google',
  model_temperature DECIMAL(3,2) DEFAULT 0.7,
  max_output_tokens INT DEFAULT 25000,
  streaming_delay INT DEFAULT 50,
  max_upload_files INT DEFAULT 10,
  max_file_size_mb INT DEFAULT 100,
  max_document_size_mb INT DEFAULT 40,
  max_document_pages INT DEFAULT 400,
  max_context_documents INT DEFAULT 8,
  embedding_provider VARCHAR(100) DEFAULT 'google',
  embedding_model VARCHAR(200) DEFAULT 'text-embedding-004',
  embedding_dimension INT DEFAULT 768,
  retrieval_top_k INT DEFAULT 10,
  use_hybrid_search BOOLEAN DEFAULT TRUE,
  use_rrf BOOLEAN DEFAULT TRUE,
  semantic_weight DECIMAL(4,3) DEFAULT 0.7,
  keyword_weight DECIMAL(4,3) DEFAULT 0.3,
  text_search_language VARCHAR(50) DEFAULT 'english',
  total_tokens_per_day INT DEFAULT 300000,
  messages_per_hour INT DEFAULT 60,
  quota_chats_per_minute INT DEFAULT 20,
  chats_per_day INT DEFAULT 80,
  max_file_upload_per_day INT DEFAULT 15,
  max_conversation_history INT DEFAULT 25,
  updated_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO summarization_chat_config (
  llm_model, llm_provider, model_temperature, max_output_tokens, streaming_delay,
  max_upload_files, max_file_size_mb,
  max_document_size_mb, max_document_pages, max_context_documents,
  embedding_provider, embedding_model, embedding_dimension, retrieval_top_k,
  use_hybrid_search, use_rrf, semantic_weight, keyword_weight, text_search_language,
  total_tokens_per_day, messages_per_hour, quota_chats_per_minute, chats_per_day,
  max_file_upload_per_day, max_conversation_history
)
SELECT
  'gemini-2.5-flash', 'google', 0.7, 25000, 50,
  10, 100,
  40, 400, 8,
  'google', 'text-embedding-004', 768, 10,
  TRUE, TRUE, 0.7, 0.3, 'english',
  300000, 60, 20, 80,
  15, 25
WHERE NOT EXISTS (SELECT 1 FROM summarization_chat_config);
