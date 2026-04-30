-- Restrict the Live model picker to exactly the three approved options:
--   gemini-3.1-flash-live-preview                  (lower acoustic richness)
--   gemini-2.5-flash-native-audio-preview-12-2025  (current default)
--   gemini-2.5-flash-native-audio-preview-09-2025  (older pinned snapshot)
-- The "latest" alias is removed from the picker; agents pinned to it are
-- migrated to the December snapshot which is the closest stable build.

UPDATE voice_agent_configurations
   SET live_model = 'gemini-2.5-flash-native-audio-preview-12-2025',
       updated_at = now()
 WHERE live_model = 'gemini-2.5-flash-native-audio-latest';

UPDATE voice_agents
   SET language_config = jsonb_set(
         COALESCE(language_config, '{}'::jsonb),
         '{admin_config,live_model}',
         '"gemini-2.5-flash-native-audio-preview-12-2025"'::jsonb,
         true
       ),
       updated_at = now()
 WHERE COALESCE(language_config #>> '{admin_config,live_model}', '') = 'gemini-2.5-flash-native-audio-latest';

DELETE FROM voice_model_pricing
 WHERE provider = 'gemini'
   AND model_id = 'gemini-2.5-flash-native-audio-latest';

-- Re-rank the three keepers so the picker shows them in the order the
-- product team requested.
UPDATE voice_model_pricing
   SET sort_order = 5,
       badge      = 'Recommended',
       is_active  = true,
       updated_at = now()
 WHERE provider = 'gemini'
   AND model_id = 'gemini-2.5-flash-native-audio-preview-12-2025';

UPDATE voice_model_pricing
   SET sort_order = 7,
       badge      = 'Pinned',
       is_active  = true,
       updated_at = now()
 WHERE provider = 'gemini'
   AND model_id = 'gemini-2.5-flash-native-audio-preview-09-2025';

UPDATE voice_model_pricing
   SET sort_order = 9,
       badge      = 'Alternative',
       description = 'Lower acoustic richness than the 2.5 native-audio previews. Some API key tiers cannot stream audio from this preview yet — fall back to a 2.5 native-audio build if the live socket closes 1008 without audio.',
       is_active  = true,
       updated_at = now()
 WHERE provider = 'gemini'
   AND model_id = 'gemini-3.1-flash-live-preview';
