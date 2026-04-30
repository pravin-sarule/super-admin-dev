-- Update voice_model_pricing with real Google pricing fetched from
-- ai.google.dev/gemini-api/docs/pricing.
--
-- Conversion: 1 USD ≈ 83.5 INR (rough live FX). Per-minute audio costs are
-- the published Google Live API rates: $0.005/min input, $0.018/min output,
-- $0.023/min combined → ₹0.42 + ₹1.50 = ₹1.92/min total. Token-based text
-- rates shown for reference but text usage during a voice call is dwarfed
-- by audio costs.
--
-- All three models are currently FREE on the AI Studio free tier during
-- preview. Paid-tier rates below kick in only when the project is on a
-- billed Google Cloud account.

-- Gemini 3.1 Flash Live Preview ------------------------------------------
UPDATE voice_model_pricing
   SET input_usd_per_million_tokens  = 0.7500,
       output_usd_per_million_tokens = 4.5000,
       input_audio_usd_per_minute    = 0.0050,
       output_audio_usd_per_minute   = 0.0180,
       inr_one_minute_total          = 1.92,
       unit_pricing = jsonb_build_object(
         'input_text',  '$0.75 / 1M tokens',
         'output_text', '$4.50 / 1M tokens',
         'input_audio', '$0.005/min (₹0.42/min)',
         'output_audio','$0.018/min (₹1.50/min)',
         'total',       '₹1.92/min audio',
         'free_tier',   'Free during preview on AI Studio free tier'
       ),
       pricing_rows = '[
         {"duration":"1 minute","input_estimate":"₹0.42","output_estimate":"₹1.50","total_estimate":"₹1.92"},
         {"duration":"5 minutes","input_estimate":"₹2.09","output_estimate":"₹7.52","total_estimate":"₹9.60"},
         {"duration":"10 minutes","input_estimate":"₹4.18","output_estimate":"₹15.03","total_estimate":"₹19.21"},
         {"duration":"30 minutes","input_estimate":"₹12.53","output_estimate":"₹45.09","total_estimate":"₹57.62"},
         {"duration":"1 hour","input_estimate":"₹25.05","output_estimate":"₹90.18","total_estimate":"₹115.23"}
       ]'::jsonb,
       updated_at = now()
 WHERE provider = 'gemini'
   AND model_id = 'gemini-3.1-flash-live-preview';

-- Gemini 2.5 Flash Native Audio (Dec 2025) -------------------------------
UPDATE voice_model_pricing
   SET input_usd_per_million_tokens  = 0.5000,
       output_usd_per_million_tokens = 2.0000,
       input_audio_usd_per_minute    = 0.0050,
       output_audio_usd_per_minute   = 0.0180,
       inr_one_minute_total          = 1.92,
       unit_pricing = jsonb_build_object(
         'input_text',  '$0.50 / 1M tokens',
         'output_text', '$2.00 / 1M tokens',
         'input_audio', '$0.005/min (₹0.42/min)',
         'output_audio','$0.018/min (₹1.50/min)',
         'total',       '₹1.92/min audio',
         'free_tier',   'Free during preview on AI Studio free tier'
       ),
       pricing_rows = '[
         {"duration":"1 minute","input_estimate":"₹0.42","output_estimate":"₹1.50","total_estimate":"₹1.92"},
         {"duration":"5 minutes","input_estimate":"₹2.09","output_estimate":"₹7.52","total_estimate":"₹9.60"},
         {"duration":"10 minutes","input_estimate":"₹4.18","output_estimate":"₹15.03","total_estimate":"₹19.21"},
         {"duration":"30 minutes","input_estimate":"₹12.53","output_estimate":"₹45.09","total_estimate":"₹57.62"},
         {"duration":"1 hour","input_estimate":"₹25.05","output_estimate":"₹90.18","total_estimate":"₹115.23"}
       ]'::jsonb,
       updated_at = now()
 WHERE provider = 'gemini'
   AND model_id = 'gemini-2.5-flash-native-audio-preview-12-2025';

-- Gemini 2.5 Flash Native Audio (Sep 2025) -------------------------------
-- Not listed on the public pricing page (Google removed older preview
-- snapshots from the table); inherits the 2.5 native-audio family rates.
UPDATE voice_model_pricing
   SET input_usd_per_million_tokens  = 0.5000,
       output_usd_per_million_tokens = 2.0000,
       input_audio_usd_per_minute    = 0.0050,
       output_audio_usd_per_minute   = 0.0180,
       inr_one_minute_total          = 1.92,
       unit_pricing = jsonb_build_object(
         'input_text',  '$0.50 / 1M tokens',
         'output_text', '$2.00 / 1M tokens',
         'input_audio', '$0.005/min (₹0.42/min)',
         'output_audio','$0.018/min (₹1.50/min)',
         'total',       '₹1.92/min audio',
         'free_tier',   'Free during preview on AI Studio free tier',
         'note',        'Inherits 2.5 native-audio family rates; not in current public pricing table.'
       ),
       pricing_rows = '[
         {"duration":"1 minute","input_estimate":"₹0.42","output_estimate":"₹1.50","total_estimate":"₹1.92"},
         {"duration":"5 minutes","input_estimate":"₹2.09","output_estimate":"₹7.52","total_estimate":"₹9.60"},
         {"duration":"10 minutes","input_estimate":"₹4.18","output_estimate":"₹15.03","total_estimate":"₹19.21"},
         {"duration":"30 minutes","input_estimate":"₹12.53","output_estimate":"₹45.09","total_estimate":"₹57.62"},
         {"duration":"1 hour","input_estimate":"₹25.05","output_estimate":"₹90.18","total_estimate":"₹115.23"}
       ]'::jsonb,
       updated_at = now()
 WHERE provider = 'gemini'
   AND model_id = 'gemini-2.5-flash-native-audio-preview-09-2025';
