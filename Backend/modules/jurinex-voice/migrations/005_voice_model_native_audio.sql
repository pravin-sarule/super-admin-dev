-- Register gemini-2.5-flash-native-audio-latest as a usable Live model and
-- migrate any existing agents off gemini-3.1-flash-live-preview, which the
-- current API keys cannot drive (WS opens but bidi audio never streams,
-- closing 1008 once user audio is sent in).
--
-- Pricing values mirror the 3.1 row as a placeholder. Replace with real
-- Google rates when available.

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
VALUES (
  'gemini',
  'gemini-2.5-flash-native-audio-latest',
  'Gemini 2.5 Flash Native Audio',
  'live_audio',
  'Stable',
  'Native audio Live model with expressive prosody. Verified compatible with Leda, Puck, Zephyr and other prebuilt voices for realtime dialogue.',
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
  5
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

-- Move existing agents off the unsupported preview model.
UPDATE voice_agent_configurations
   SET live_model = 'gemini-2.5-flash-native-audio-latest',
       updated_at = now()
 WHERE live_model = 'gemini-3.1-flash-live-preview';

UPDATE voice_agents
   SET language_config = jsonb_set(
         COALESCE(language_config, '{}'::jsonb),
         '{admin_config,live_model}',
         '"gemini-2.5-flash-native-audio-latest"'::jsonb,
         true
       ),
       updated_at = now()
 WHERE COALESCE(language_config #>> '{admin_config,live_model}', '') = 'gemini-3.1-flash-live-preview';
