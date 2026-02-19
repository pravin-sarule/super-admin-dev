-- LLM parameter configuration per model (temperature, thinking, tools, etc.)
CREATE TABLE IF NOT EXISTS llm_model_parameters (
  id SERIAL PRIMARY KEY,
  model_id INTEGER NOT NULL UNIQUE REFERENCES llm_models(id) ON DELETE CASCADE,
  temperature NUMERIC(3,2) DEFAULT 1.0 CHECK (temperature >= 0 AND temperature <= 2),
  media_resolution VARCHAR(50) DEFAULT 'default',
  thinking_mode BOOLEAN DEFAULT false,
  thinking_budget BOOLEAN DEFAULT false,
  thinking_level VARCHAR(50) DEFAULT 'default',
  structured_outputs_enabled BOOLEAN DEFAULT false,
  structured_outputs_config JSONB DEFAULT '{}',
  code_execution BOOLEAN DEFAULT false,
  function_calling_enabled BOOLEAN DEFAULT false,
  function_calling_config JSONB DEFAULT '{}',
  grounding_google_search BOOLEAN DEFAULT false,
  url_context BOOLEAN DEFAULT false,
  system_instructions TEXT DEFAULT '',
  api_key_status VARCHAR(50) DEFAULT 'none',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_llm_model_parameters_model_id ON llm_model_parameters(model_id);
