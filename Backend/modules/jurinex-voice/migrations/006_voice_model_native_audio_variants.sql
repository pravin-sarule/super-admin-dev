-- Register additional Gemini Live native-audio variants in voice_model_pricing.
-- The "latest" alias points at whichever 09-2025 / 12-2025 build Google has
-- promoted; the dated previews are pinned snapshots. The 3.1 flash live
-- preview row already exists from migration 004 and is kept as an
-- "alternative" (lower acoustic richness) option.
--
-- Pricing rows mirror the 2.5 native audio "latest" row as placeholders
-- until real Google rates are wired in.

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
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'Gemini 2.5 Flash Native Audio (Dec 2025)',
  'live_audio',
  'Pinned',
  'Pinned December 2025 snapshot of the 2.5 Flash native-audio Live model. Use when you want a frozen build for production parity testing.',
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
  7
),
(
  'gemini',
  'gemini-2.5-flash-native-audio-preview-09-2025',
  'Gemini 2.5 Flash Native Audio (Sep 2025)',
  'live_audio',
  'Pinned',
  'Pinned September 2025 snapshot of the 2.5 Flash native-audio Live model. Older than the December preview but still verified on the current API keys.',
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
  8
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

-- Re-tag the 3.1 flash live preview row so the UI flags it as the lower-
-- richness alternative without removing it from the picker.
UPDATE voice_model_pricing
   SET badge       = 'Alternative',
       description = 'Lower acoustic richness than 2.5 native audio. Some API key tiers cannot stream audio from this preview yet — fall back to 2.5 native audio if the live socket closes 1008 without audio.',
       sort_order  = 12,
       updated_at  = now()
 WHERE provider = 'gemini'
   AND model_id = 'gemini-3.1-flash-live-preview';
