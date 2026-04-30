-- Jurinex Voice — allowed Gemini voice models and INR pricing estimates.
-- Source values are the pricing rows supplied by the admin UI request.

CREATE TABLE IF NOT EXISTS voice_model_pricing (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                      TEXT NOT NULL DEFAULT 'gemini',
  model_id                      TEXT NOT NULL,
  display_name                  TEXT NOT NULL,
  category                      TEXT NOT NULL,
  badge                         TEXT,
  description                   TEXT NOT NULL,
  input_usd_per_million_tokens  NUMERIC(10,4),
  output_usd_per_million_tokens NUMERIC(10,4),
  input_audio_usd_per_minute    NUMERIC(10,4),
  output_audio_usd_per_minute   NUMERIC(10,4),
  inr_one_minute_total          NUMERIC(10,2) NOT NULL,
  pricing_rows                  JSONB NOT NULL DEFAULT '[]'::jsonb,
  unit_pricing                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active                     BOOLEAN NOT NULL DEFAULT true,
  sort_order                    INT NOT NULL DEFAULT 0,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT voice_model_pricing_model_uq UNIQUE (provider, model_id)
);

CREATE INDEX IF NOT EXISTS voice_model_pricing_active_idx
  ON voice_model_pricing (is_active, sort_order, display_name);

INSERT INTO voice_model_pricing (
  provider,
  model_id,
  display_name,
  category,
  badge,
  description,
  input_usd_per_million_tokens,
  output_usd_per_million_tokens,
  input_audio_usd_per_minute,
  output_audio_usd_per_minute,
  inr_one_minute_total,
  unit_pricing,
  pricing_rows,
  sort_order
)
VALUES
(
  'gemini',
  'gemini-3.1-flash-live-preview',
  'Gemini 3.1 Flash Live Preview',
  'live_audio',
  'New',
  'Low-latency audio-to-audio model optimized for real-time dialogue with acoustic nuance detection, numeric precision, and multimodal awareness.',
  3.0000,
  12.0000,
  0.0050,
  0.0180,
  2.18,
  jsonb_build_object(
    'input_audio', '₹0.47/min',
    'output_audio', '₹1.71/min',
    'total', '₹2.18/min'
  ),
  '[
    {"duration":"1 minute","input_estimate":"₹0.47","output_estimate":"₹1.71","total_estimate":"₹2.18"},
    {"duration":"5 minutes","input_estimate":"₹2.37","output_estimate":"₹8.53","total_estimate":"₹10.90"},
    {"duration":"10 minutes","input_estimate":"₹4.74","output_estimate":"₹17.06","total_estimate":"₹21.80"},
    {"duration":"30 minutes","input_estimate":"₹14.22","output_estimate":"₹51.18","total_estimate":"₹65.39"},
    {"duration":"1 hour","input_estimate":"₹28.43","output_estimate":"₹102.35","total_estimate":"₹130.78"}
  ]'::jsonb,
  10
),
(
  'gemini',
  'gemini-3.1-flash-tts-preview',
  'Gemini 3.1 Flash TTS Preview',
  'tts',
  'New',
  'Powerful, low-latency speech generation with natural outputs, steerable prompts, and expressive audio tags for narration control.',
  1.0000,
  20.0000,
  NULL,
  NULL,
  3.66,
  jsonb_build_object(
    'text_input', '₹0.02/min',
    'audio_output', '₹3.64/min',
    'total', '₹3.66/min'
  ),
  '[
    {"duration":"1 minute","input_estimate":"₹0.02","output_estimate":"₹3.64","total_estimate":"₹3.66"},
    {"duration":"5 minutes","input_estimate":"₹0.09","output_estimate":"₹18.20","total_estimate":"₹18.29"},
    {"duration":"10 minutes","input_estimate":"₹0.19","output_estimate":"₹36.39","total_estimate":"₹36.58"},
    {"duration":"30 minutes","input_estimate":"₹0.57","output_estimate":"₹109.18","total_estimate":"₹109.74"},
    {"duration":"1 hour","input_estimate":"₹1.14","output_estimate":"₹218.35","total_estimate":"₹219.49"}
  ]'::jsonb,
  20
),
(
  'gemini',
  'gemini-2.5-pro-preview-tts',
  'Gemini 2.5 Pro Preview TTS',
  'tts',
  NULL,
  'Text-to-speech audio model optimized for powerful, low-latency speech generation and more natural steerable outputs.',
  1.0000,
  20.0000,
  NULL,
  NULL,
  3.66,
  jsonb_build_object(
    'text_input', '₹0.02/min',
    'audio_output', '₹3.64/min',
    'total', '₹3.66/min'
  ),
  '[
    {"duration":"1 minute","input_estimate":"₹0.02","output_estimate":"₹3.64","total_estimate":"₹3.66"},
    {"duration":"5 minutes","input_estimate":"₹0.09","output_estimate":"₹18.20","total_estimate":"₹18.29"},
    {"duration":"10 minutes","input_estimate":"₹0.19","output_estimate":"₹36.39","total_estimate":"₹36.58"},
    {"duration":"30 minutes","input_estimate":"₹0.57","output_estimate":"₹109.18","total_estimate":"₹109.74"},
    {"duration":"1 hour","input_estimate":"₹1.14","output_estimate":"₹218.35","total_estimate":"₹219.49"}
  ]'::jsonb,
  30
),
(
  'gemini',
  'gemini-2.5-flash-preview-tts',
  'Gemini 2.5 Flash Preview TTS',
  'tts',
  NULL,
  'Price-performant, low-latency, controllable speech generation.',
  0.5000,
  10.0000,
  NULL,
  NULL,
  1.83,
  jsonb_build_object(
    'text_input', '₹0.01/min',
    'audio_output', '₹1.82/min',
    'total', '₹1.83/min'
  ),
  '[
    {"duration":"1 minute","input_estimate":"₹0.01","output_estimate":"₹1.82","total_estimate":"₹1.83"},
    {"duration":"5 minutes","input_estimate":"₹0.05","output_estimate":"₹9.10","total_estimate":"₹9.15"},
    {"duration":"10 minutes","input_estimate":"₹0.09","output_estimate":"₹18.20","total_estimate":"₹18.29"},
    {"duration":"30 minutes","input_estimate":"₹0.28","output_estimate":"₹54.59","total_estimate":"₹54.87"},
    {"duration":"1 hour","input_estimate":"₹0.57","output_estimate":"₹109.18","total_estimate":"₹109.74"}
  ]'::jsonb,
  40
)
ON CONFLICT (provider, model_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  badge = EXCLUDED.badge,
  description = EXCLUDED.description,
  input_usd_per_million_tokens = EXCLUDED.input_usd_per_million_tokens,
  output_usd_per_million_tokens = EXCLUDED.output_usd_per_million_tokens,
  input_audio_usd_per_minute = EXCLUDED.input_audio_usd_per_minute,
  output_audio_usd_per_minute = EXCLUDED.output_audio_usd_per_minute,
  inr_one_minute_total = EXCLUDED.inr_one_minute_total,
  unit_pricing = EXCLUDED.unit_pricing,
  pricing_rows = EXCLUDED.pricing_rows,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();
