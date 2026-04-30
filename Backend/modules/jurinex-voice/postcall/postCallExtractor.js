/**
 * Runs the admin-configured post-call extraction job after a Live
 * session ends. Persists every attempt (pending → completed/failed) to
 * voice_post_call_extractions so admins can replay the timeline from
 * SQL or the future Debug Logs UI.
 *
 *   await runExtraction({
 *     sessionId, agentId, agentName,
 *     transcript,                  // built by buildTranscriptText()
 *     fieldList,                   // builderSettings.post_call_extraction
 *     model,                       // builderSettings.post_call_model
 *   });
 *
 * Failures never throw into the caller — they are logged + persisted
 * with status='failed' so a flaky model can't break session teardown.
 */

const pool = require('../db/jurinexVoiceDB');
const agentTest = require('../tests/agentTest.service');
const voiceLogger = require('../observability/voiceLogger');

const DEFAULT_MODEL =
  process.env.JURINEX_VOICE_POST_CALL_MODEL || 'gemini-2.5-flash';

// Map UI-side type tokens to Gemini structured-output JSON schema types.
const SCHEMA_TYPE = {
  text: 'string',
  string: 'string',
  boolean: 'boolean',
  bool: 'boolean',
  number: 'number',
  integer: 'integer',
  enum: 'string',
};

const buildSchema = (fieldList = []) => {
  const enabled = fieldList.filter((f) => f && f.key && f.enabled !== false);
  if (enabled.length === 0) return null;
  const properties = {};
  const required = [];
  for (const field of enabled) {
    const baseType = SCHEMA_TYPE[String(field.type || 'string').toLowerCase()] || 'string';
    const property = {
      type: baseType,
      description: String(field.label || field.key),
    };
    if (field.type === 'enum' && Array.isArray(field.options) && field.options.length) {
      property.enum = field.options.map((o) => String(o));
    }
    properties[field.key] = property;
    required.push(field.key);
  }
  return {
    type: 'object',
    properties,
    required,
  };
};

const buildTranscriptText = (turns = []) => {
  if (!Array.isArray(turns) || turns.length === 0) return '';
  return turns
    .map((turn) => {
      const role = turn.role === 'agent' ? 'Agent' : turn.role === 'user' ? 'User' : 'Note';
      const text = String(turn.text || '').trim();
      if (!text) return '';
      return `${role}: ${text}`;
    })
    .filter(Boolean)
    .join('\n');
};

const buildPrompt = ({ transcript, fieldList, agentName }) => {
  const fieldHints = fieldList
    .filter((f) => f.enabled !== false && f.key)
    .map((f) => {
      const type = String(f.type || 'string');
      const opts =
        type === 'enum' && Array.isArray(f.options) && f.options.length
          ? ` (one of: ${f.options.join(', ')})`
          : '';
      return `  • ${f.key} (${type}${opts}): ${f.label || f.key}`;
    })
    .join('\n');
  return [
    `You are a post-call analyst for the voice agent "${agentName || 'this agent'}".`,
    'Read the transcript below and produce a STRICT JSON object that matches the requested schema.',
    'Rules:',
    '- Use only what the transcript actually contains. If a field cannot be answered, return an empty string for strings, false for booleans, and 0 for numbers.',
    '- Do not invent facts.',
    '- Do not include any commentary outside the JSON.',
    '',
    'Fields to extract:',
    fieldHints || '  (none — return an empty object)',
    '',
    'Transcript:',
    '"""',
    transcript || '(empty transcript)',
    '"""',
  ].join('\n');
};

const insertPending = async ({
  sessionId,
  agentId,
  fieldList,
  transcript,
  extractionModel,
}) => {
  const { rows } = await pool.query(
    `INSERT INTO voice_post_call_extractions
       (session_id, agent_id, status, extraction_fields, transcript, extraction_model, started_at)
     VALUES ($1, $2, 'running', $3::jsonb, $4, $5, now())
     RETURNING id`,
    [
      sessionId || null,
      agentId || null,
      JSON.stringify(fieldList || []),
      transcript || null,
      extractionModel,
    ]
  );
  return rows[0]?.id;
};

const completeRow = async ({ id, status, extractedData, errorMessage, latencyMs }) => {
  if (!id) return;
  await pool.query(
    `UPDATE voice_post_call_extractions
        SET status         = $2,
            extracted_data = $3::jsonb,
            error_message  = $4,
            latency_ms     = $5,
            completed_at   = now()
      WHERE id = $1`,
    [id, status, JSON.stringify(extractedData || {}), errorMessage || null, latencyMs || null]
  );
};

const drawBox = (title, lines) => {
  const width = 64;
  const top = '╔' + '═'.repeat(width - 2) + '╗';
  const sep = '╠' + '═'.repeat(width - 2) + '╣';
  const bot = '╚' + '═'.repeat(width - 2) + '╝';
  const pad = (text) => {
    const t = text.length > width - 4 ? text.slice(0, width - 5) + '…' : text;
    return `║ ${t}${' '.repeat(width - 3 - t.length)}║`;
  };
  const out = [top, pad(title), sep];
  for (const [k, v] of lines) {
    const display = v == null ? '-' : String(typeof v === 'object' ? JSON.stringify(v) : v);
    out.push(pad(`${String(k).padEnd(14)} ${display.length > 44 ? display.slice(0, 43) + '…' : display}`));
  }
  out.push(bot);
  return out.join('\n');
};

// Skip if the admin hasn't enabled any extraction field.
const isSchemaEnabled = (fieldList) =>
  Array.isArray(fieldList) && fieldList.some((f) => f && f.key && f.enabled !== false);

const runExtraction = async ({
  sessionId,
  agentId,
  agentName,
  transcript,
  transcriptTurns,
  fieldList,
  model,
}) => {
  const text = transcript || buildTranscriptText(transcriptTurns);
  if (!isSchemaEnabled(fieldList)) {
    console.log('[POST_CALL_EXTRACT] skipped — no enabled fields configured', { sessionId, agentId });
    await pool.query(
      `INSERT INTO voice_post_call_extractions
         (session_id, agent_id, status, extraction_fields, transcript)
       VALUES ($1, $2, 'skipped', $3::jsonb, $4)`,
      [sessionId || null, agentId || null, JSON.stringify(fieldList || []), text || null]
    ).catch(() => {});
    return { status: 'skipped', reason: 'no_fields_enabled' };
  }
  if (!text || text.length < 10) {
    console.log('[POST_CALL_EXTRACT] skipped — empty/short transcript', {
      sessionId,
      agentId,
      transcriptLength: text?.length || 0,
    });
    await pool.query(
      `INSERT INTO voice_post_call_extractions
         (session_id, agent_id, status, extraction_fields, transcript)
       VALUES ($1, $2, 'skipped', $3::jsonb, $4)`,
      [sessionId || null, agentId || null, JSON.stringify(fieldList || []), text || null]
    ).catch(() => {});
    return { status: 'skipped', reason: 'empty_transcript' };
  }

  const schema = buildSchema(fieldList);
  const extractionModel = model || DEFAULT_MODEL;
  const startedAt = Date.now();
  console.log(
    drawBox(`📊 POST-CALL EXTRACT START`, [
      ['Session', sessionId ? String(sessionId).slice(0, 8) + '…' : '-'],
      ['Agent', agentId ? String(agentId).slice(0, 8) + '…' : '-'],
      ['Model', extractionModel],
      ['Fields', fieldList.filter((f) => f.enabled !== false).map((f) => f.key).join(', ')],
      ['Transcript', text.length + ' chars'],
    ])
  );

  let rowId;
  try {
    rowId = await insertPending({
      sessionId,
      agentId,
      fieldList,
      transcript: text,
      extractionModel,
    });
  } catch (err) {
    voiceLogger.warn('post_call_extraction insert failed', {
      summary: { sessionId, agentId, error: err.message },
    });
  }

  try {
    const ai = agentTest.createClient();
    const response = await ai.models.generateContent({
      model: extractionModel,
      contents: [
        {
          role: 'user',
          parts: [{ text: buildPrompt({ transcript: text, fieldList, agentName }) }],
        },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    });
    const raw =
      response?.text ||
      (response?.candidates?.[0]?.content?.parts || [])
        .map((p) => p.text || '')
        .join('') ||
      '';
    let extracted;
    try {
      extracted = JSON.parse(raw);
    } catch (parseErr) {
      // Try to slice out the first JSON object.
      const match = raw.match(/\{[\s\S]*\}/);
      extracted = match ? JSON.parse(match[0]) : {};
    }
    const latencyMs = Date.now() - startedAt;
    await completeRow({
      id: rowId,
      status: 'completed',
      extractedData: extracted,
      latencyMs,
    });
    console.log(
      drawBox(`✅ POST-CALL EXTRACT DONE`, [
        ['Session', sessionId ? String(sessionId).slice(0, 8) + '…' : '-'],
        ['LatencyMs', latencyMs],
        ['Keys', Object.keys(extracted).join(', ')],
      ])
    );
    return { status: 'completed', extracted, latency_ms: latencyMs, row_id: rowId };
  } catch (err) {
    const latencyMs = Date.now() - startedAt;
    const errorMessage = err && err.message ? err.message : String(err);
    console.error('[POST_CALL_EXTRACT] failed', {
      sessionId,
      agentId,
      error: errorMessage,
    });
    await completeRow({
      id: rowId,
      status: 'failed',
      errorMessage,
      latencyMs,
    });
    return { status: 'failed', error: errorMessage, row_id: rowId };
  }
};

module.exports = {
  runExtraction,
  buildSchema,
  buildTranscriptText,
};
