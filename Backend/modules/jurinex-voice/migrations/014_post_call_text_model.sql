-- Register gemini-2.5-flash as a selectable text model for Post-Call
-- Data Extraction. The post-call dropdown reads from voice_model_pricing,
-- so the model must exist as a row before the agent builder UI will let
-- it be picked. Category is 'post_call_text' so future filtering can
-- distinguish text-only models from live-audio ones.

INSERT INTO voice_model_pricing (
  provider,
  model_id,
  display_name,
  category,
  badge,
  description,
  input_usd_per_million_tokens,
  output_usd_per_million_tokens,
  inr_one_minute_total,
  unit_pricing,
  pricing_rows,
  sort_order
)
VALUES (
  'gemini',
  'gemini-2.5-flash',
  'Gemini 2.5 Flash',
  'post_call_text',
  'Recommended',
  'Fast text model used for post-call structured extraction (call summary, sentiment, etc.). Returns JSON via Gemini structured output.',
  0.3000,
  2.5000,
  0.00,
  jsonb_build_object(
    'input_text',  '$0.30 / 1M tokens',
    'output_text', '$2.50 / 1M tokens'
  ),
  '[]'::jsonb,
  3
)
ON CONFLICT (provider, model_id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  category     = EXCLUDED.category,
  badge        = EXCLUDED.badge,
  description  = EXCLUDED.description,
  sort_order   = EXCLUDED.sort_order,
  is_active    = true,
  updated_at   = now();

-- Migrate existing agents off the old default.
UPDATE voice_agent_configurations
   SET custom_settings = jsonb_set(
         COALESCE(custom_settings, '{}'::jsonb),
         '{agent_builder,post_call_model}',
         '"gemini-2.5-flash"'::jsonb,
         true
       ),
       updated_at = now()
 WHERE COALESCE(custom_settings #>> '{agent_builder,post_call_model}', '')
       IN ('gemini-3.1-flash-live-preview',
           'gemini-2.5-flash-native-audio-preview-12-2025',
           'gemini-2.5-flash-native-audio-preview-09-2025',
           '');
