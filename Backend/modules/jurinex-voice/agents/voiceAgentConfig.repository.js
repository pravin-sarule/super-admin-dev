/**
 * Repository for first-class voice agent configuration tables.
 */
const pool = require('../db/jurinexVoiceDB');

const DEFAULT_TEXT_PROMPT =
  'You are the Nexintel AI Support Agent. Provide fast, accurate solutions based ONLY on the provided document context. If the answer is not found, state: "I am sorry, I do not have information on that in our records." Keep responses under 3 sentences.';

const DEFAULT_AUDIO_PROMPT =
  'You are the Nexintel AI Support Agent. Provide fast, accurate answers based ONLY on documents retrieved via search_documents. Keep spoken responses under 20 seconds.';
const DEFAULT_LIVE_MODEL = 'gemini-2.5-flash-native-audio-latest';

const CONFIG_COLS = `
  agent_id, text_model, live_model, voice_name, voice_tag, temperature,
  top_p, max_tokens, top_k_results, text_chat_system_prompt,
  audio_live_system_prompt, custom_settings, created_at, updated_at
`;

const TRANSFER_COLS = `
  agent_id, name, description, routing_mode, static_destination,
  destination_prompt, e164_format, transfer_type, on_hold_music,
  ring_duration_seconds, navigate_ivr, internal_queue, agent_wait_seconds,
  whisper_debrief, whisper_message, three_way_ring_tone, three_way_debrief,
  handoff_mode, handoff_message, displayed_caller_id, custom_settings,
  created_at, updated_at
`;

const ensureRows = async (agentId) => {
  await pool.query(
    `INSERT INTO voice_agent_configurations (
       agent_id, text_chat_system_prompt, audio_live_system_prompt
     )
     SELECT $1, COALESCE(system_prompt, $2), $3
       FROM voice_agents
      WHERE id = $1
     ON CONFLICT (agent_id) DO NOTHING`,
    [agentId, DEFAULT_TEXT_PROMPT, DEFAULT_AUDIO_PROMPT]
  );

  await pool.query(
    `INSERT INTO voice_agent_transfer_configs (
       agent_id, description, destination_prompt, handoff_message
     )
     SELECT $1,
            'Transfer the call to a human agent',
            'If the user wants to reach support, transfer to +1 (925) 222-2222; if the user wants to reach sales, transfer to +1 (925) 333-3333',
            'Continue translating for the customer and the technician'
       FROM voice_agents
      WHERE id = $1
     ON CONFLICT (agent_id) DO NOTHING`,
    [agentId]
  );
};

const getAllowedModelIds = async (client) => {
  const { rows } = await client.query(
    `SELECT model_id
       FROM voice_model_pricing
      WHERE is_active = true
      ORDER BY sort_order ASC, display_name ASC`
  );
  return rows.map((row) => row.model_id);
};

const resolveAllowedModel = (modelId, allowedModelIds) => {
  if (allowedModelIds.includes(modelId)) return modelId;
  if (allowedModelIds.includes(DEFAULT_LIVE_MODEL)) return DEFAULT_LIVE_MODEL;
  return allowedModelIds[0] || DEFAULT_LIVE_MODEL;
};

const toApi = ({ config, transfer }) => ({
  text_model: config.text_model,
  live_model: config.live_model,
  voice: config.voice_name,
  voice_tag: config.voice_tag,
  temperature: Number(config.temperature),
  top_p: Number(config.top_p),
  max_tokens: config.max_tokens,
  top_k_results: config.top_k_results,
  system_prompts: {
    text_chat: config.text_chat_system_prompt,
    audio_live: config.audio_live_system_prompt,
  },
  custom_settings: config.custom_settings || {},
  transfer_call: {
    name: transfer.name,
    description: transfer.description,
    routing_mode: transfer.routing_mode,
    static_destination: transfer.static_destination,
    destination_prompt: transfer.destination_prompt,
    e164_format: transfer.e164_format,
    transfer_type: transfer.transfer_type,
    on_hold_music: transfer.on_hold_music,
    ring_duration_seconds: transfer.ring_duration_seconds,
    navigate_ivr: transfer.navigate_ivr,
    internal_queue: transfer.internal_queue,
    agent_wait_seconds: transfer.agent_wait_seconds,
    whisper_debrief: transfer.whisper_debrief,
    whisper_message: transfer.whisper_message,
    three_way_ring_tone: transfer.three_way_ring_tone,
    three_way_debrief: transfer.three_way_debrief,
    handoff_mode: transfer.handoff_mode,
    handoff_message: transfer.handoff_message,
    displayed_caller_id: transfer.displayed_caller_id,
    custom_settings: transfer.custom_settings || {},
  },
});

const get = async (agentId) => {
  await ensureRows(agentId);

  const [configResult, transferResult] = await Promise.all([
    pool.query(`SELECT ${CONFIG_COLS} FROM voice_agent_configurations WHERE agent_id = $1`, [agentId]),
    pool.query(`SELECT ${TRANSFER_COLS} FROM voice_agent_transfer_configs WHERE agent_id = $1`, [agentId]),
  ]);

  if (!configResult.rows[0] || !transferResult.rows[0]) return null;
  return toApi({ config: configResult.rows[0], transfer: transferResult.rows[0] });
};

const update = async (agentId, payload = {}) => {
  await ensureRows(agentId);

  const transfer = payload.transfer_call || {};
  const prompts = payload.system_prompts || {};
  const builderSettings = payload.custom_settings?.agent_builder || {};
  const builderLanguages = Array.isArray(builderSettings.languages)
    ? builderSettings.languages.map((item) => String(item).trim()).filter(Boolean)
    : null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const allowedModelIds = await getAllowedModelIds(client);
    const resolvedLiveModel = resolveAllowedModel(payload.live_model, allowedModelIds);
    const customSettings = {
      ...(payload.custom_settings || {}),
    };
    if (customSettings.agent_builder) {
      customSettings.agent_builder = {
        ...customSettings.agent_builder,
        post_call_model: resolveAllowedModel(
          customSettings.agent_builder.post_call_model || resolvedLiveModel,
          allowedModelIds
        ),
      };
    }

    const configResult = await client.query(
      `INSERT INTO voice_agent_configurations (
         agent_id, text_model, live_model, voice_name, voice_tag, temperature,
         top_p, max_tokens, top_k_results, text_chat_system_prompt,
         audio_live_system_prompt, custom_settings
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
       ON CONFLICT (agent_id) DO UPDATE SET
         text_model = EXCLUDED.text_model,
         live_model = EXCLUDED.live_model,
         voice_name = EXCLUDED.voice_name,
         voice_tag = EXCLUDED.voice_tag,
         temperature = EXCLUDED.temperature,
         top_p = EXCLUDED.top_p,
         max_tokens = EXCLUDED.max_tokens,
         top_k_results = EXCLUDED.top_k_results,
         text_chat_system_prompt = EXCLUDED.text_chat_system_prompt,
         audio_live_system_prompt = EXCLUDED.audio_live_system_prompt,
         custom_settings = EXCLUDED.custom_settings,
         updated_at = now()
       RETURNING ${CONFIG_COLS}`,
      [
        agentId,
        payload.text_model || 'gemini-1.5-flash',
        resolvedLiveModel,
        payload.voice || payload.voice_name || 'Puck',
        payload.voice_tag || 'Upbeat',
        payload.temperature ?? 0.1,
        payload.top_p ?? 0.95,
        payload.max_tokens ?? 150,
        payload.top_k_results ?? 5,
        prompts.text_chat || DEFAULT_TEXT_PROMPT,
        prompts.audio_live || DEFAULT_AUDIO_PROMPT,
        JSON.stringify(customSettings),
      ]
    );

    const transferResult = await client.query(
      `INSERT INTO voice_agent_transfer_configs (
         agent_id, name, description, routing_mode, static_destination,
         destination_prompt, e164_format, transfer_type, on_hold_music,
         ring_duration_seconds, navigate_ivr, internal_queue, agent_wait_seconds,
         whisper_debrief, whisper_message, three_way_ring_tone, three_way_debrief,
         handoff_mode, handoff_message, displayed_caller_id, custom_settings
       )
       VALUES (
         $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb
       )
       ON CONFLICT (agent_id) DO UPDATE SET
         name = EXCLUDED.name,
         description = EXCLUDED.description,
         routing_mode = EXCLUDED.routing_mode,
         static_destination = EXCLUDED.static_destination,
         destination_prompt = EXCLUDED.destination_prompt,
         e164_format = EXCLUDED.e164_format,
         transfer_type = EXCLUDED.transfer_type,
         on_hold_music = EXCLUDED.on_hold_music,
         ring_duration_seconds = EXCLUDED.ring_duration_seconds,
         navigate_ivr = EXCLUDED.navigate_ivr,
         internal_queue = EXCLUDED.internal_queue,
         agent_wait_seconds = EXCLUDED.agent_wait_seconds,
         whisper_debrief = EXCLUDED.whisper_debrief,
         whisper_message = EXCLUDED.whisper_message,
         three_way_ring_tone = EXCLUDED.three_way_ring_tone,
         three_way_debrief = EXCLUDED.three_way_debrief,
         handoff_mode = EXCLUDED.handoff_mode,
         handoff_message = EXCLUDED.handoff_message,
         displayed_caller_id = EXCLUDED.displayed_caller_id,
         custom_settings = EXCLUDED.custom_settings,
         updated_at = now()
       RETURNING ${TRANSFER_COLS}`,
      [
        agentId,
        transfer.name || 'transfer_call',
        transfer.description || null,
        transfer.routing_mode || 'dynamic',
        transfer.static_destination || null,
        transfer.destination_prompt || null,
        transfer.e164_format ?? true,
        transfer.transfer_type || 'warm',
        transfer.on_hold_music || 'Ringtone',
        transfer.ring_duration_seconds ?? 30,
        transfer.navigate_ivr ?? false,
        transfer.internal_queue ?? true,
        transfer.agent_wait_seconds ?? 30,
        transfer.whisper_debrief ?? false,
        transfer.whisper_message || null,
        transfer.three_way_ring_tone ?? true,
        transfer.three_way_debrief ?? true,
        transfer.handoff_mode || 'prompt',
        transfer.handoff_message || null,
        transfer.displayed_caller_id || 'retell_agent',
        JSON.stringify(transfer.custom_settings || {}),
      ]
    );

    const savedConfig = toApi({ config: configResult.rows[0], transfer: transferResult.rows[0] });
    const primaryPrompt = prompts.audio_live || prompts.text_chat || DEFAULT_AUDIO_PROMPT;

    await client.query(
      `UPDATE voice_agents
          SET system_prompt = $2,
              language_config = jsonb_set(
                jsonb_set(
                  COALESCE(language_config, '{}'::jsonb),
                  '{admin_config}',
                  $3::jsonb,
                  true
                ),
                '{languages}',
                COALESCE($4::jsonb, COALESCE(language_config #> '{languages}', '[]'::jsonb)),
                true
              ),
              updated_at = now()
        WHERE id = $1`,
      [
        agentId,
        primaryPrompt,
        JSON.stringify(savedConfig),
        builderLanguages ? JSON.stringify(builderLanguages) : null,
      ]
    );

    await client.query('COMMIT');
    return savedConfig;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  get,
  update,
  ensureRows,
};
