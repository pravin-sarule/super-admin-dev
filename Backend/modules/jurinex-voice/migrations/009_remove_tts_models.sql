-- Drop standalone TTS models from voice_model_pricing. The voice agent
-- builder only exposes Live audio models now; TTS is handled internally
-- by the live-audio models (no separate picker entry needed).

DELETE FROM voice_model_pricing
 WHERE provider = 'gemini'
   AND category = 'tts';
