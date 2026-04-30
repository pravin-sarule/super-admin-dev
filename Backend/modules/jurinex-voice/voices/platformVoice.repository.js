/**
 * Repository for platform_voices.
 */
const pool = require('../db/jurinexVoiceDB');

const VOICE_COLS = `
  id, provider, voice_key, voice_name, display_name, style, gender, accent,
  age_group, default_live_model, language_codes, preview_duration_seconds,
  preview_prompt, config, is_active, sort_order, created_at, updated_at
`;

const toApi = (row) => ({
  id: row.id,
  provider: row.provider,
  voice_key: row.voice_key,
  name: row.voice_name,
  display_name: row.display_name,
  style: row.style,
  gender: row.gender,
  accent: row.accent,
  age: row.age_group,
  live_model: row.default_live_model,
  language_codes: row.language_codes || [],
  preview_duration_seconds: row.preview_duration_seconds,
  preview_prompt: row.preview_prompt,
  config: row.config || {},
  is_active: row.is_active,
  sort_order: row.sort_order,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const PREVIEW_AUDIO_COLS = `
  id, voice_id, voice_key, language_code, live_model, tts_model, prompt_hash,
  prompt_text, generation_source, duration_seconds, audio_mime_type,
  audio_bytes, gcs_bucket, gcs_object_name, gcs_uri, public_url,
  created_at, updated_at
`;

const findPreviewAudio = async ({
  voice_key,
  language_code,
  live_model,
  tts_model,
  prompt_hash,
}) => {
  const { rows } = await pool.query(
    `SELECT ${PREVIEW_AUDIO_COLS}
       FROM platform_voice_preview_audios
      WHERE voice_key = $1
        AND language_code = $2
        AND live_model = $3
        AND tts_model = $4
        AND prompt_hash = $5
      LIMIT 1`,
    [voice_key, language_code, live_model, tts_model, prompt_hash]
  );
  return rows[0] || null;
};

const insertPreviewAudio = async ({
  voice_id,
  voice_key,
  language_code,
  live_model,
  tts_model,
  prompt_hash,
  prompt_text,
  generation_source,
  duration_seconds,
  audio_mime_type,
  audio_bytes,
  gcs_bucket,
  gcs_object_name,
  gcs_uri,
  public_url = null,
}) => {
  const { rows } = await pool.query(
    `INSERT INTO platform_voice_preview_audios
       (voice_id, voice_key, language_code, live_model, tts_model, prompt_hash,
        prompt_text, generation_source, duration_seconds, audio_mime_type,
        audio_bytes, gcs_bucket, gcs_object_name, gcs_uri, public_url)
     VALUES
       ($1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,
        $11,$12,$13,$14,$15)
     ON CONFLICT (voice_key, language_code, live_model, tts_model, prompt_hash)
     DO UPDATE SET
        voice_id = EXCLUDED.voice_id,
        prompt_text = EXCLUDED.prompt_text,
        generation_source = EXCLUDED.generation_source,
        duration_seconds = EXCLUDED.duration_seconds,
        audio_mime_type = EXCLUDED.audio_mime_type,
        audio_bytes = EXCLUDED.audio_bytes,
        gcs_bucket = EXCLUDED.gcs_bucket,
        gcs_object_name = EXCLUDED.gcs_object_name,
        gcs_uri = EXCLUDED.gcs_uri,
        public_url = EXCLUDED.public_url,
        updated_at = now()
     RETURNING ${PREVIEW_AUDIO_COLS}`,
    [
      voice_id,
      voice_key,
      language_code,
      live_model,
      tts_model,
      prompt_hash,
      prompt_text,
      generation_source,
      duration_seconds,
      audio_mime_type,
      audio_bytes,
      gcs_bucket,
      gcs_object_name,
      gcs_uri,
      public_url,
    ]
  );
  return rows[0] || null;
};

const list = async ({ gender, accent, search, active = true } = {}) => {
  const params = [];
  const where = [];

  if (active !== undefined && active !== null) {
    params.push(active);
    where.push(`is_active = $${params.length}`);
  }
  if (gender) {
    params.push(gender);
    where.push(`gender = $${params.length}`);
  }
  if (accent) {
    params.push(accent);
    where.push(`accent = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(voice_name ILIKE $${params.length} OR style ILIKE $${params.length} OR accent ILIKE $${params.length})`);
  }

  const { rows } = await pool.query(
    `SELECT ${VOICE_COLS}
       FROM platform_voices
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY sort_order ASC, voice_name ASC`,
    params
  );

  return rows.map(toApi);
};

const getByKeyOrName = async (value) => {
  const { rows } = await pool.query(
    `SELECT ${VOICE_COLS}
       FROM platform_voices
      WHERE voice_key = $1 OR voice_name = $1 OR lower(voice_name) = lower($1)
      LIMIT 1`,
    [value]
  );
  return rows[0] ? toApi(rows[0]) : null;
};

module.exports = {
  list,
  getByKeyOrName,
  findPreviewAudio,
  insertPreviewAudio,
};
