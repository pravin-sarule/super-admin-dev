-- Jurinex Voice — platform voice catalog.
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS platform_voices (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider                 TEXT NOT NULL DEFAULT 'gemini',
  voice_key                TEXT NOT NULL,
  voice_name               TEXT NOT NULL,
  display_name             TEXT NOT NULL,
  style                    TEXT NOT NULL,
  gender                   TEXT NOT NULL,
  accent                   TEXT NOT NULL,
  age_group                TEXT NOT NULL,
  default_live_model       TEXT NOT NULL DEFAULT 'gemini-3.1-flash-live-preview',
  language_codes           TEXT[] NOT NULL DEFAULT ARRAY['en-US'],
  preview_duration_seconds INT NOT NULL DEFAULT 12,
  preview_prompt           TEXT NOT NULL,
  config                   JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active                BOOLEAN NOT NULL DEFAULT true,
  sort_order               INT NOT NULL DEFAULT 0,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_voices_duration_ck CHECK (preview_duration_seconds > 0 AND preview_duration_seconds <= 30),
  CONSTRAINT platform_voices_provider_key_uq UNIQUE (provider, voice_key)
);

CREATE INDEX IF NOT EXISTS platform_voices_active_idx ON platform_voices (is_active, sort_order, voice_name);
CREATE INDEX IF NOT EXISTS platform_voices_filter_idx ON platform_voices (gender, accent);

WITH seed(sort_order, voice_name, style, gender, accent, age_group, language_codes) AS (
  VALUES
    (10,  'Puck',          'Upbeat',   'Neutral', 'American',   'Middle Aged', ARRAY['en-US','en-IN','hi-IN','mr-IN']),
    (20,  'Charon',        'Bright',   'Neutral', 'American',   'Middle Aged', ARRAY['en-US','en-IN','hi-IN','mr-IN']),
    (30,  'Kore',          'Clear',    'Female',  'American',   'Young',       ARRAY['en-US','en-IN','hi-IN','mr-IN']),
    (40,  'Fenrir',        'Distinct', 'Male',    'American',   'Middle Aged', ARRAY['en-US','en-IN','hi-IN','mr-IN']),
    (50,  'Leda',          'Calm',     'Female',  'American',   'Middle Aged', ARRAY['en-US','en-IN','hi-IN','mr-IN']),
    (60,  'Orus',          'Clear',    'Male',    'American',   'Middle Aged', ARRAY['en-US','en-IN','hi-IN','mr-IN']),
    (70,  'Aoede',         'Bright',   'Female',  'American',   'Young',       ARRAY['en-US','en-IN','hi-IN','mr-IN']),
    (80,  'Callirrhoe',    'Calm',     'Female',  'American',   'Middle Aged', ARRAY['en-US','en-IN','hi-IN','mr-IN']),
    (90,  'Despina',       'Calm',     'Female',  'British',    'Young',       ARRAY['en-GB','en-US']),
    (100, 'Algieba',       'Calm',     'Female',  'British',    'Middle Aged', ARRAY['en-GB','en-US']),
    (110, 'Achernar',      'Calm',     'Female',  'Indian',     'Middle Aged', ARRAY['en-IN','hi-IN','mr-IN','en-US']),
    (120, 'Schedar',       'Distinct', 'Male',    'Indian',     'Middle Aged', ARRAY['en-IN','hi-IN','mr-IN','en-US']),
    (130, 'Achird',        'Distinct', 'Male',    'American',   'Young',       ARRAY['en-US','en-IN','hi-IN','mr-IN']),
    (140, 'Sadachbia',     'Distinct', 'Neutral', 'Australian', 'Middle Aged', ARRAY['en-AU','en-US']),
    (150, 'Enceladus',     'Distinct', 'Male',    'American',   'Middle Aged', ARRAY['en-US','en-IN','hi-IN','mr-IN']),
    (160, 'Algenib',       'Distinct', 'Male',    'American',   'Young',       ARRAY['en-US','en-IN','hi-IN','mr-IN']),
    (170, 'Gacrux',        'Distinct', 'Female',  'American',   'Middle Aged', ARRAY['en-US','en-IN','hi-IN','mr-IN']),
    (180, 'Zubenelgenubi', 'Distinct', 'Male',    'American',   'Middle Aged', ARRAY['en-US','en-IN','hi-IN','mr-IN']),
    (190, 'Sadaltager',    'Distinct', 'Female',  'American',   'Young',       ARRAY['en-US','en-IN','hi-IN','mr-IN']),
    (200, 'Rasalgethi',    'Distinct', 'Male',    'British',    'Middle Aged', ARRAY['en-GB','en-US']),
    (210, 'Pulcherrima',   'Bright',   'Female',  'American',   'Young',       ARRAY['en-US','en-IN','hi-IN','mr-IN']),
    (220, 'Vindemiatrix',  'Clear',    'Female',  'American',   'Middle Aged', ARRAY['en-US','en-IN','hi-IN','mr-IN']),
    (230, 'Sulafat',       'Calm',     'Female',  'American',   'Middle Aged', ARRAY['en-US','en-IN','hi-IN','mr-IN'])
)
INSERT INTO platform_voices (
  provider,
  voice_key,
  voice_name,
  display_name,
  style,
  gender,
  accent,
  age_group,
  language_codes,
  preview_prompt,
  config,
  sort_order
)
SELECT
  'gemini',
  'gemini-' || voice_name,
  voice_name,
  voice_name,
  style,
  gender,
  accent,
  age_group,
  language_codes,
  'Hello, this is {{voice_name}}, a {{style}} {{accent}} Gemini Live voice for Jurinex support. I am previewing with {{live_model}} in {{language_label}}. I can greet callers, answer clearly, and keep the conversation calm, professional, and helpful.',
  jsonb_build_object(
    'provider', 'gemini',
    'voice_id', 'gemini-' || voice_name,
    'style', style,
    'gender', gender,
    'accent', accent,
    'age_group', age_group,
    'recommended_for', ARRAY['support', 'multilingual_agent', 'jurinex_voice']
  ),
  sort_order
FROM seed
ON CONFLICT (provider, voice_key) DO UPDATE SET
  voice_name = EXCLUDED.voice_name,
  display_name = EXCLUDED.display_name,
  style = EXCLUDED.style,
  gender = EXCLUDED.gender,
  accent = EXCLUDED.accent,
  age_group = EXCLUDED.age_group,
  language_codes = EXCLUDED.language_codes,
  preview_prompt = EXCLUDED.preview_prompt,
  config = EXCLUDED.config,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();
