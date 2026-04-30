-- Jurinex Voice — cached platform voice preview WAV files.
-- Stores one generated recording per voice/model/language/prompt hash.

CREATE TABLE IF NOT EXISTS platform_voice_preview_audios (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_id                 UUID REFERENCES platform_voices(id) ON DELETE CASCADE,
  voice_key                TEXT NOT NULL,
  language_code            TEXT NOT NULL,
  live_model               TEXT NOT NULL,
  tts_model                TEXT NOT NULL,
  prompt_hash              TEXT NOT NULL,
  prompt_text              TEXT NOT NULL,
  generation_source        TEXT NOT NULL,
  duration_seconds         INT NOT NULL DEFAULT 12,
  audio_mime_type          TEXT NOT NULL DEFAULT 'audio/wav',
  audio_bytes              INT NOT NULL,
  gcs_bucket               TEXT NOT NULL,
  gcs_object_name          TEXT NOT NULL,
  gcs_uri                  TEXT NOT NULL,
  public_url               TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT platform_voice_preview_audio_duration_ck CHECK (duration_seconds > 0 AND duration_seconds <= 30),
  CONSTRAINT platform_voice_preview_audio_bytes_ck CHECK (audio_bytes > 0),
  CONSTRAINT platform_voice_preview_audio_uq UNIQUE (
    voice_key,
    language_code,
    live_model,
    tts_model,
    prompt_hash
  )
);

CREATE INDEX IF NOT EXISTS platform_voice_preview_audios_voice_idx
  ON platform_voice_preview_audios (voice_key, language_code, created_at DESC);

CREATE INDEX IF NOT EXISTS platform_voice_preview_audios_gcs_idx
  ON platform_voice_preview_audios (gcs_bucket, gcs_object_name);
