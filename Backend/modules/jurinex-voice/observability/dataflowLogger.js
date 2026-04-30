/**
 * Beginner-friendly, ASCII-boxed dataflow logs for the Jurinex Voice
 * pipeline. Also persists important events to `voice_debug_events` so they
 * are visible from the Debug Logs UI.
 *
 * Never log secrets (API keys, full GCS service-account JSON, raw document
 * text beyond a short preview).
 */

const voiceLogger = require('./voiceLogger');
const pool = require('../db/jurinexVoiceDB');

const truncate = (val, max = 120) => {
  if (val == null) return val;
  const str = typeof val === 'string' ? val : JSON.stringify(val);
  return str.length > max ? `${str.slice(0, max)}…` : str;
};

const drawBox = (title, rows) => {
  const width = 60;
  const top = '╭' + '─'.repeat(width - 2) + '╮';
  const sep = '├' + '─'.repeat(width - 2) + '┤';
  const bot = '╰' + '─'.repeat(width - 2) + '╯';

  const padLine = (text) => {
    const t = text.length > width - 4 ? text.slice(0, width - 5) + '…' : text;
    return `│ ${t}${' '.repeat(width - 3 - t.length)}│`;
  };

  const lines = [top, padLine(title), sep];
  for (const [k, v] of rows) {
    const display = v == null ? '-' : truncate(v, 40);
    lines.push(padLine(`${String(k).padEnd(12)} ${display}`));
  }
  lines.push(bot);
  return lines.join('\n');
};

const persistEvent = async ({
  trace_id = null,
  agent_id = null,
  document_id = null,
  event_type,
  event_stage = null,
  message,
  payload = null,
}) => {
  try {
    await pool.query(
      `INSERT INTO voice_debug_events
         (trace_id, agent_id, document_id, event_type, event_stage, message, payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        trace_id,
        agent_id,
        document_id,
        event_type,
        event_stage,
        message,
        payload ? JSON.stringify(payload) : null,
      ]
    );
  } catch (err) {
    voiceLogger.warn('persistEvent failed', {
      summary: { event_type, event_stage, error: err.message },
    });
  }
};

const logVoiceEvent = async (eventType, stage, message, payload = {}) => {
  voiceLogger.flow(message, {
    summary: { eventType, stage },
    extra: payload,
  });
  await persistEvent({
    trace_id: payload?.trace_id || payload?.traceId || null,
    agent_id: payload?.agent_id || null,
    document_id: payload?.document_id || null,
    event_type: eventType,
    event_stage: stage,
    message,
    payload,
  });
};

const logAgentBuilderEvent = async ({
  trace_id = null,
  agent_id = null,
  event_type = 'agent_builder_event',
  stage = 'ui',
  message,
  payload = {},
}) => {
  const safePayload = {
    ...payload,
    trace_id: trace_id || payload.trace_id || payload.traceId || null,
    agent_id: agent_id || payload.agent_id || null,
  };

  console.log(
    drawBox('JURINEX VOICE AGENT BUILDER', [
      ['Event', event_type],
      ['Stage', stage],
      ['Agent ID', safePayload.agent_id || '-'],
      ['Trace ID', safePayload.trace_id || '-'],
      ['Message', message],
    ])
  );

  await logVoiceEvent(event_type, stage, message, safePayload);
};

const logUploadStarted = async ({ document_id, agent_id, filename, bucket, content_type, size }) => {
  console.log(
    drawBox('🎙️  JURINEX VOICE DOCUMENT UPLOAD STARTED', [
      ['Document ID', document_id],
      ['Agent ID', agent_id || 'global'],
      ['Filename', filename],
      ['Bucket', bucket],
      ['Content-Type', content_type],
      ['Size (bytes)', size],
    ])
  );
  await logVoiceEvent('upload_started', 'upload', 'Upload received', {
    document_id,
    agent_id,
    filename,
    bucket,
    content_type,
    size,
  });
};

const logGcsUploaded = async ({ document_id, gcs_uri, gcs_object_name }) => {
  console.log(
    drawBox('☁️  GCS UPLOAD COMPLETED', [
      ['Document ID', document_id],
      ['Object', gcs_object_name],
      ['URI', gcs_uri],
    ])
  );
  await logVoiceEvent('gcs_uploaded', 'gcs_upload', 'File uploaded to GCS', {
    document_id,
    gcs_uri,
    gcs_object_name,
  });
};

const logGcsFailed = async ({ document_id, error }) => {
  voiceLogger.error('GCS upload failed', { summary: { document_id, error } });
  await logVoiceEvent('gcs_failed', 'gcs_upload', 'GCS upload failed', {
    document_id,
    error,
  });
};

const logIngestStarted = async ({ document_id, agent_id }) => {
  console.log(
    drawBox('⚙️  KB INGEST PIPELINE STARTED', [
      ['Document ID', document_id],
      ['Agent ID', agent_id || 'global'],
    ])
  );
  await logVoiceEvent('ingest_started', 'ingest', 'Ingest pipeline started', {
    document_id,
    agent_id,
  });
};

const logTextExtracted = async ({ document_id, char_count, source_type }) => {
  voiceLogger.flow('📝 Text extracted', {
    summary: { document_id, char_count, source_type },
  });
  await logVoiceEvent('text_extracted', 'extract', 'Text extracted from document', {
    document_id,
    char_count,
    source_type,
  });
};

const logChunksCreated = async ({ document_id, chunk_count, token_count }) => {
  voiceLogger.flow('✂️  Chunks created', {
    summary: { document_id, chunk_count, token_count },
  });
  await logVoiceEvent('chunks_created', 'chunk', 'Chunks created', {
    document_id,
    chunk_count,
    token_count,
  });
};

const logEmbeddingsCreated = async ({ document_id, chunk_count, model, dim }) => {
  voiceLogger.flow('🧠 Embeddings created', {
    summary: { document_id, chunk_count, model, dim },
  });
  await logVoiceEvent('embeddings_created', 'embed', 'Embeddings generated', {
    document_id,
    chunk_count,
    model,
    dim,
  });
};

const logDocumentReady = async ({ document_id, agent_id, chunk_count }) => {
  console.log(
    drawBox('✅ DOCUMENT READY', [
      ['Document ID', document_id],
      ['Agent ID', agent_id || 'global'],
      ['Chunks', chunk_count],
    ])
  );
  await logVoiceEvent('document_ready', 'ready', 'Document ready', {
    document_id,
    agent_id,
    chunk_count,
  });
};

const logDocumentFailed = async ({ document_id, agent_id, stage, error }) => {
  console.log(
    drawBox('❌ DOCUMENT PROCESSING FAILED', [
      ['Document ID', document_id],
      ['Agent ID', agent_id || 'global'],
      ['Stage', stage],
      ['Error', truncate(error, 40)],
    ])
  );
  await logVoiceEvent('document_failed', stage, `Document failed at ${stage}`, {
    document_id,
    agent_id,
    error: truncate(error, 1000),
  });
};

const logSearchStarted = async ({ trace_id, agent_id, query, k, source }) => {
  voiceLogger.flow('🔎 KB search started', {
    summary: { trace_id, agent_id, k, source, query: truncate(query, 80) },
  });
  await logVoiceEvent('search_started', 'search', 'Search started', {
    trace_id,
    agent_id,
    query: truncate(query, 500),
    k,
    source,
  });
};

const logSearchCompleted = async ({
  trace_id,
  agent_id,
  query,
  result_count,
  latency_ms,
  source,
}) => {
  voiceLogger.flow('✅ KB search completed', {
    summary: { trace_id, agent_id, result_count, latency_ms, source },
  });
  await logVoiceEvent('search_completed', 'search', 'Search completed', {
    trace_id,
    agent_id,
    query: truncate(query, 500),
    result_count,
    latency_ms,
    source,
  });
};

module.exports = {
  logVoiceEvent,
  logAgentBuilderEvent,
  logUploadStarted,
  logGcsUploaded,
  logGcsFailed,
  logIngestStarted,
  logTextExtracted,
  logChunksCreated,
  logEmbeddingsCreated,
  logDocumentReady,
  logDocumentFailed,
  logSearchStarted,
  logSearchCompleted,
};
