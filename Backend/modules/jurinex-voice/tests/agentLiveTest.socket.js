const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const { Modality } = require('@google/genai');
const { WebSocketServer, WebSocket } = require('ws');

const { JWT_SECRET } = require('../../../config/env');
const agentRepo = require('../agents/voiceAgent.repository');
const agentConfigRepo = require('../agents/voiceAgentConfig.repository');
const kbRepo = require('../kb/kb.repository');
const dataflow = require('../observability/dataflowLogger');
const voiceLogger = require('../observability/voiceLogger');
const agentTest = require('./agentTest.service');
const toolDispatcher = require('../tools/dispatcher');
const toolDeclarations = require('../tools/declarations');
const toolPromptsRepo = require('../tools/toolPrompts.repository');
const promptFragments = require('../tools/systemPromptFragments.repository');
const postCallExtractor = require('../postcall/postCallExtractor');

const LIVE_TEST_PATH_RE =
  /^\/(?:api\/)?admin\/jurinex-voice\/agents\/([^/]+)\/live-test\/?$/;

const DEFAULT_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const INPUT_AUDIO_MIME_TYPE = 'audio/pcm;rate=16000';
const OUTPUT_AUDIO_MIME_TYPE = 'audio/pcm;rate=24000';
const WELCOME_TURN_TIMEOUT_MS = Number(process.env.JURINEX_VOICE_LIVE_WELCOME_TIMEOUT_MS || 3500);

const toLiveModelPath = (model) => {
  const value = String(model || DEFAULT_LIVE_MODEL).trim();
  return value.startsWith('models/') ? value : `models/${value}`;
};

const safeJson = (value, fallback = null) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const sendJson = (ws, payload) => {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify(payload));
};

const summarizeError = (err) => ({
  name: err?.name || 'Error',
  message: err?.message || String(err || 'Unknown error'),
  code: err?.code || null,
});

const getBearerToken = (req, url) => {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  return url.searchParams.get('token') || '';
};

const verifySocketAuth = async ({ req, url, pool }) => {
  const apiKey =
    req.headers['x-admin-api-key'] ||
    req.headers['x-admin-apikey'] ||
    url.searchParams.get('admin_key') ||
    '';

  if (process.env.ADMIN_API_KEY && String(apiKey).trim() === process.env.ADMIN_API_KEY) {
    return { method: 'api_key' };
  }

  const token = getBearerToken(req, url);
  if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) {
    return { method: 'admin_token' };
  }

  if (JWT_SECRET && pool && token) {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = decoded.id != null ? Number(decoded.id) : decoded.id;
    const userResult = await pool.query(
      `SELECT a.id, a.email, r.name AS role
         FROM super_admins a
         JOIN admin_roles r ON a.role_id = r.id
        WHERE a.id = $1`,
      [userId]
    );
    const user = userResult.rows[0];
    if (user && ['super-admin', 'user-admin', 'admin', 'support-admin'].includes(user.role)) {
      return { method: 'jwt', userId: user.id, email: user.email };
    }
  }

  const err = new Error('Unauthorized live voice test socket.');
  err.statusCode = 401;
  throw err;
};

const writeUpgradeError = (socket, statusCode, message) => {
  const statusText = statusCode === 401 ? 'Unauthorized' : 'Bad Request';
  socket.write(
    `HTTP/1.1 ${statusCode} ${statusText}\r\n` +
      'Connection: close\r\n' +
      'Content-Type: text/plain; charset=utf-8\r\n' +
      `Content-Length: ${Buffer.byteLength(message)}\r\n` +
      '\r\n' +
      message
  );
  socket.destroy();
};

const extractTranscriptText = (node) => {
  if (!node || typeof node !== 'object') return '';
  return String(node.text || node.transcript || node.value || '').trim();
};

const extractLiveAudioParts = (message) => {
  const parts = message?.serverContent?.modelTurn?.parts || [];
  return parts
    .map((part) => part?.inlineData)
    .filter((inlineData) => inlineData?.data)
    .map((inlineData) => ({
      data: inlineData.data,
      mime_type: inlineData.mimeType || inlineData.mime_type || OUTPUT_AUDIO_MIME_TYPE,
    }));
};

const extractLiveTextParts = (message) =>
  (message?.serverContent?.modelTurn?.parts || [])
    .map((part) => part?.text || '')
    .filter(Boolean)
    .join('');

const KNOWLEDGE_BASE_BUDGET_BYTES = Number(
  process.env.JURINEX_VOICE_LIVE_KB_BUDGET_BYTES || 45_000
);
const KNOWLEDGE_BASE_CHUNKS_PER_DOC = Number(
  process.env.JURINEX_VOICE_LIVE_KB_CHUNKS_PER_DOC || 40
);

const fetchKnowledgeBaseContext = async (documentIds) => {
  const ids = Array.isArray(documentIds) ? documentIds.filter(Boolean) : [];
  if (ids.length === 0) return { sections: [], totalBytes: 0, truncated: false };

  const sections = [];
  let totalBytes = 0;
  let truncated = false;

  for (const id of ids) {
    const doc = await kbRepo.getDocument(id).catch(() => null);
    if (!doc) continue;
    if (doc.status && String(doc.status).toLowerCase() !== 'ready') continue;

    const chunks = await kbRepo
      .getDocumentChunks(id, { limit: KNOWLEDGE_BASE_CHUNKS_PER_DOC })
      .catch(() => []);
    if (!chunks.length) continue;

    const parts = [];
    for (const chunk of chunks) {
      const text = String(chunk.text || '').trim();
      if (!text) continue;
      const heading = Array.isArray(chunk.heading_path) && chunk.heading_path.length
        ? ` [${chunk.heading_path.join(' > ')}]`
        : '';
      const block = `${heading ? `${heading.trim()}\n` : ''}${text}`;
      const blockBytes = Buffer.byteLength(block, 'utf8');
      if (totalBytes + blockBytes > KNOWLEDGE_BASE_BUDGET_BYTES) {
        truncated = true;
        break;
      }
      parts.push(block);
      totalBytes += blockBytes;
    }

    if (parts.length === 0) continue;
    sections.push({
      title: doc.title || doc.original_filename || 'Untitled document',
      body: parts.join('\n\n'),
    });

    if (truncated) break;
  }

  return { sections, totalBytes, truncated };
};

// Async — pulls the wrapper template (header + rules) from
// voice_system_prompt_fragments and substitutes the actual KB chunks.
const formatKnowledgeBaseBlock = async (kb) => {
  if (!kb || !kb.sections.length) return '';
  const sectionsBlock = kb.sections
    .map((section, idx) => `### Document ${idx + 1}: ${section.title}\n${section.body}`)
    .join('\n\n');
  const truncatedNote = kb.truncated
    ? await promptFragments.renderFragment('knowledge_base_truncated_note').catch(() => '')
    : '';
  const rendered = await promptFragments
    .renderFragment('knowledge_base_header', {
      kb_sections_block: sectionsBlock,
      kb_truncated_note: truncatedNote,
    })
    .catch((err) => {
      voiceLogger.warn('knowledge_base_header fragment render failed', {
        summary: { error: err.message },
      });
      return '';
    });
  return rendered;
};

const DAY_LABELS = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

// Compute the variables that the DB-stored prompt templates can reference.
// Templates use {{var}} placeholders rendered by toolPromptsRepo.
const buildToolPromptVariables = ({
  languageLabel,
  calendarSettings = {},
  transferConfig = {},
}) => {
  const wh = calendarSettings.working_hours || {};
  const enabledDays = Object.entries(wh)
    .filter(([, cfg]) => cfg?.enabled)
    .map(([day, cfg]) => `  - ${DAY_LABELS[day] || day}: ${cfg.start}–${cfg.end}`);
  const disabledDays = Object.entries(wh)
    .filter(([, cfg]) => !cfg?.enabled)
    .map(([day]) => DAY_LABELS[day] || day);
  const blocked = Array.isArray(calendarSettings.blocked_dates)
    ? calendarSettings.blocked_dates
    : [];
  return {
    language_label: languageLabel || 'English',
    timezone: calendarSettings.timezone || 'Asia/Kolkata',
    default_meeting_minutes: Number(calendarSettings.default_meeting_minutes) || 30,
    working_hours_block: enabledDays.length
      ? enabledDays.join('\n')
      : '  - (no working hours configured — refuse all bookings politely)',
    disabled_days: disabledDays.length ? disabledDays.join(', ') : '(none)',
    blocked_dates: blocked.length ? blocked.join(', ') : '(none)',
    view_only_warning: calendarSettings.view_only
      ? 'VIEW-ONLY MODE: you may CHECK availability but you must NOT call calendar_book. If a caller asks to book, say bookings are not available right now and offer a callback.'
      : '',
    transfer_destination:
      transferConfig.static_destination || transferConfig.destination || '(not configured)',
    transfer_type: transferConfig.transfer_type || 'warm',
  };
};

// Async because it reads tool prompt rows from the database (cached 60s).
const buildLiveSystemInstruction = async ({
  audioPrompt,
  languageLabel,
  knowledgeBase,
  enabledFunctionKeys = [],
  calendarSettings = {},
  transferConfig = {},
}) => {
  const variables = buildToolPromptVariables({
    languageLabel,
    calendarSettings,
    transferConfig,
  });
  const toolBlock = await toolPromptsRepo
    .renderForEnabledTools({ enabledFunctionKeys, variables })
    .catch((err) => {
      voiceLogger.warn('tool prompt render failed; continuing without tool guidance', {
        summary: { error: err.message, enabledFunctionKeys },
      });
      return '';
    });

  // Pull the two non-tool live-session fragments from DB. Falls back to
  // empty string if a row is missing/inactive so the live session never
  // dies on a prompt-table edit.
  const fragmentVars = { language_label: languageLabel || 'English' };
  const [liveBase, realtimeRules, kbBlock] = await Promise.all([
    promptFragments.renderFragment('live_session_base', fragmentVars).catch(() => ''),
    promptFragments.renderFragment('live_session_realtime_rules', fragmentVars).catch(() => ''),
    formatKnowledgeBaseBlock(knowledgeBase),
  ]);

  return [
    String(audioPrompt || '').trim(),
    '',
    liveBase,
    '',
    realtimeRules,
    kbBlock,
    toolBlock,
  ]
    .filter(Boolean)
    .join('\n');
};

const attachAgentLiveTestSocket = (server, { pool } = {}) => {
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    maxPayload: 2 * 1024 * 1024,
  });

  server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const match = url.pathname.match(LIVE_TEST_PATH_RE);
    if (!match) return;

    const agentId = decodeURIComponent(match[1]);
    try {
      const auth = await verifySocketAuth({ req, url, pool });
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req, { agentId, auth });
      });
    } catch (err) {
      voiceLogger.warn('live voice test socket unauthorized', {
        summary: {
          agentId,
          path: url.pathname,
          error: err.message,
        },
      });
      writeUpgradeError(socket, err.statusCode || 401, err.message || 'Unauthorized');
    }
  });

  wss.on('connection', (ws, req, { agentId, auth }) => {
    const sessionId = randomUUID();
    const connectedAt = Date.now();
    let geminiSession = null;
    let setupStarted = false;
    let closed = false;
    let modelReady = false;
    let geminiClosed = false;
    let liveState = null;
    let lastInputTranscript = '';
    // Accumulator for the post-call extraction job. Pushed every time
    // Gemini emits a final input or output transcription (i.e. after a
    // turn completes). We keep this on the connection scope so it
    // survives until ws.on('close') fires the extractor.
    let pendingInputTranscript = '';
    let pendingOutputTranscript = '';
    const transcriptTurns = [];
    let counters = {
      audioPacketsIn: 0,
      audioBytesIn: 0,
      audioChunksOut: 0,
      audioBytesOut: 0,
      textDeltasOut: 0,
      inputTranscripts: 0,
      outputTranscripts: 0,
    };

    const logLifecycle = (event_type, stage, message, payload = {}) =>
      dataflow
        .logAgentBuilderEvent({
          event_type,
          stage,
          message,
          agent_id: agentId,
          payload: {
            session_id: sessionId,
            admin_actor: auth?.method || 'unknown',
            ...payload,
          },
        })
        .catch((err) => {
          voiceLogger.warn('live voice test dataflow log failed', {
            summary: {
              event_type,
              session_id: sessionId,
              error: err.message,
            },
          });
        });

    // ── PIPELINE TRACER ────────────────────────────────────────────
    // Records every meaningful pipeline transition with elapsed-time
    // latencies, prints a Rich-style box, and persists to
    // voice_debug_events so we can replay the timeline from the
    // Debug Logs UI even after console output is gone.
    const pipelineTimes = { session_open: connectedAt };
    const pipelineMarks = [];
    const sinceConn = () => Date.now() - connectedAt;
    const sinceStage = (label) =>
      pipelineTimes[label] ? Date.now() - pipelineTimes[label] : null;

    // Circular-safe stringify so a payload that accidentally references a
    // shared array (e.g. pipelineMarks) cannot crash the server during
    // log formatting. Truncates output to keep box rows readable.
    const safeStringify = (value) => {
      const seen = new WeakSet();
      try {
        return JSON.stringify(value, (_key, v) => {
          if (v && typeof v === 'object') {
            if (seen.has(v)) return '[Circular]';
            seen.add(v);
          }
          return v;
        });
      } catch (err) {
        return `[unserializable: ${err.message}]`;
      }
    };

    const drawPipelineBox = (stage, lines) => {
      const width = 64;
      const top = '┏' + '━'.repeat(width - 2) + '┓';
      const sep = '┠' + '─'.repeat(width - 2) + '┨';
      const bot = '┗' + '━'.repeat(width - 2) + '┛';
      const pad = (text) => {
        const t = text.length > width - 4 ? text.slice(0, width - 5) + '…' : text;
        return `┃ ${t}${' '.repeat(width - 3 - t.length)}┃`;
      };
      const out = [top, pad(`🎙️  PIPELINE → ${stage.toUpperCase()}`), sep];
      for (const [k, v] of lines) {
        const display = v == null ? '-' : typeof v === 'object' ? safeStringify(v) : String(v);
        out.push(pad(`${String(k).padEnd(14)} ${display.length > 44 ? display.slice(0, 43) + '…' : display}`));
      }
      out.push(bot);
      return out.join('\n');
    };

    // Strip live references (the pipelineMarks array, functions, very long
    // strings) before persisting/logging so we never produce a payload that
    // can self-reference once it gets pushed onto pipelineMarks.
    const sanitizePayload = (payload) => {
      const out = {};
      for (const [k, v] of Object.entries(payload || {})) {
        if (v == null) {
          out[k] = v;
        } else if (Array.isArray(v)) {
          // Shallow-clone arrays so the persisted snapshot never aliases
          // the live pipelineMarks array.
          out[k] = v.map((item) =>
            item && typeof item === 'object' ? { ...item } : item
          );
        } else if (typeof v === 'object') {
          out[k] = { ...v };
        } else {
          out[k] = v;
        }
      }
      return out;
    };

    const pipeline = (stage, payload = {}) => {
      try {
        pipelineTimes[stage] = pipelineTimes[stage] || Date.now();
        const tFromConn = sinceConn();
        const sanitized = sanitizePayload(payload);
        const mark = {
          stage,
          t_ms: tFromConn,
          ts: new Date().toISOString(),
          ...sanitized,
        };
        pipelineMarks.push(mark);

        const lines = [
          ['Session', sessionId.slice(0, 8) + '…'],
          ['Agent', agentId.slice(0, 8) + '…'],
          ['t+', `${(tFromConn / 1000).toFixed(2)}s since socket open`],
        ];
        Object.entries(sanitized).forEach(([k, v]) => lines.push([k, v]));
        console.log(drawPipelineBox(stage, lines));

        void dataflow
          .logVoiceEvent(
            `live_pipeline_${stage}`,
            'live_pipeline',
            `Live pipeline reached stage: ${stage}`,
            {
              session_id: sessionId,
              agent_id: agentId,
              admin_actor: auth?.method || 'unknown',
              stage,
              t_ms_since_socket_open: tFromConn,
              ...sanitized,
            }
          )
          .catch(() => {});
      } catch (err) {
        // Never let a logging bug bring down the server. Just emit a
        // plain console line and move on.
        console.warn('[JURINEX_VOICE_LIVE] pipeline log failed', {
          stage,
          error: err && err.message ? err.message : String(err),
        });
      }
    };

    // Lightweight categorizer for incoming Gemini server messages.
    const messageKind = (m) => {
      if (!m || typeof m !== 'object') return 'unknown';
      if (m.setupComplete) return 'setupComplete';
      if (m.toolCall) return 'toolCall';
      if (m.toolCallCancellation) return 'toolCallCancellation';
      if (m.sessionResumptionUpdate) return 'sessionResumptionUpdate';
      if (m.goAway) return 'goAway';
      if (m.usageMetadata && !m.serverContent) return 'usageMetadata';
      const sc = m.serverContent;
      if (!sc) return 'unknownServerMessage';
      const tags = [];
      if (sc.inputTranscription) tags.push('inputTranscription');
      if (sc.outputTranscription) tags.push('outputTranscription');
      if (sc.modelTurn) {
        const audio = (sc.modelTurn.parts || []).filter((p) => p.inlineData).length;
        const text = (sc.modelTurn.parts || []).filter((p) => p.text).length;
        tags.push(`modelTurn(audio=${audio},text=${text})`);
      }
      if (sc.interrupted) tags.push('interrupted');
      if (sc.generationComplete) tags.push('generationComplete');
      if (sc.turnComplete) tags.push('turnComplete');
      return tags.length ? tags.join('+') : 'serverContent(empty)';
    };

    const closeGemini = () => {
      try {
        geminiSession?.sendRealtimeInput?.({ audioStreamEnd: true });
      } catch {
        /* ignore stream end errors */
      }
      try {
        geminiSession?.close?.();
      } catch {
        /* ignore close errors */
      }
      geminiSession = null;
    };

    // Tools that decide the call is over (end_call, transfer_call,
    // agent_transfer) call this so we can let any in-flight farewell
    // audio finish, notify the browser, then close everything cleanly.
    const SESSION_END_GRACE_MS = Number(
      process.env.JURINEX_VOICE_LIVE_TOOL_END_GRACE_MS || 4500
    );
    const scheduleSessionEnd = ({ reason, farewell, source, transfer, agentTransfer }) => {
      if (liveState?.endingScheduled) return;
      if (liveState) liveState.endingScheduled = true;
      pipeline('tool_session_end_scheduled', {
        reason,
        source,
        farewell_preview: farewell ? String(farewell).slice(0, 80) : null,
        grace_ms: SESSION_END_GRACE_MS,
        transfer: transfer || null,
        agent_transfer: agentTransfer || null,
      });
      sendJson(ws, {
        type: 'tool_session_end',
        reason,
        source,
        farewell: farewell || null,
        transfer: transfer || null,
        agent_transfer: agentTransfer || null,
        session_id: sessionId,
      });
      setTimeout(() => {
        closeGemini();
        closeSocket(1000, `Session ended by ${source || 'tool'} (${reason})`);
      }, SESSION_END_GRACE_MS).unref?.();
    };

    const closeSocket = (code = 1011, reason = 'Live voice test failed') => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(code, reason);
      }
    };

    const sendListeningReady = (reason = 'ready') => {
      if (!liveState || liveState.listeningReadySent) return;
      liveState.listeningReadySent = true;
      if (liveState.welcomeTimer) {
        clearTimeout(liveState.welcomeTimer);
        liveState.welcomeTimer = null;
      }
      if (liveState.awaitingWelcomeComplete) {
        liveState.awaitingWelcomeComplete = false;
      }
      pipeline('listening_ready', {
        reason,
        welcome_sent: Boolean(liveState.welcomeSent),
        latency_from_setup_ms: sinceStage('setup_complete'),
      });
      sendJson(ws, { type: 'listening_ready', reason, session_id: sessionId });
    };

    const advanceLiveConversation = (source) => {
      if (!liveState || !modelReady || geminiClosed) return;
      if (!geminiSession) {
        console.log('[JURINEX_VOICE_LIVE] waiting for SDK session before advancing conversation', {
          sessionId,
          agentId,
          source,
          shouldSpeakFirst: Boolean(liveState.shouldSpeakFirst),
        });
        return;
      }

      if (liveState.shouldSpeakFirst && liveState.welcomeMessage && !liveState.welcomeSent) {
        liveState.welcomeSent = true;
        liveState.awaitingWelcomeComplete = true;
        // Prefer the DB-rendered template; fall back to a minimal hardcoded
        // line only if the fragment row is missing/inactive so the call
        // doesn't die silently.
        const welcomePrompt =
          liveState.welcomePromptTemplate ||
          `Start the call now by saying this greeting naturally in ${liveState.languageLabel}: ${liveState.welcomeMessage}`;
        pipeline('welcome_sent', {
          source,
          welcome_preview: liveState.welcomeMessage.slice(0, 120),
          language_label: liveState.languageLabel,
          envelope: 'realtimeInput.text',
        });
        // Per Google's Live API doc, live text input must use
        // realtimeInput.text. Using clientContent (history/prefill) here
        // mixes turn semantics with audio output and is a known
        // trigger for `1008 / Operation is not implemented` on
        // Gemini Live audio sessions.
        try {
          geminiSession.sendRealtimeInput({ text: welcomePrompt });
        } catch (err) {
          // Fallback for older SDK builds that don't accept text on
          // sendRealtimeInput — use sendClientContent so the welcome
          // still goes out. Logged so we can see if this branch fires.
          console.warn('[JURINEX_VOICE_LIVE] sendRealtimeInput(text) unsupported, falling back to sendClientContent', {
            sessionId,
            agentId,
            error: err && err.message,
          });
          geminiSession.sendClientContent({
            turns: [welcomePrompt],
            turnComplete: true,
          });
        }
        liveState.welcomeTimer = setTimeout(() => {
          if (!liveState || liveState.listeningReadySent || geminiClosed) return;
          console.warn('[JURINEX_VOICE_LIVE] welcome turn timed out before audio/turnComplete; starting microphone anyway', {
            sessionId,
            agentId,
            timeoutMs: WELCOME_TURN_TIMEOUT_MS,
            audioChunksOut: counters.audioChunksOut,
            textDeltasOut: counters.textDeltasOut,
          });
          void logLifecycle(
            'agent_test_live_welcome_timeout',
            'live_test_socket',
            'AI-first welcome did not complete before timeout; microphone listening started',
            {
              timeout_ms: WELCOME_TURN_TIMEOUT_MS,
              audio_chunks_out: counters.audioChunksOut,
              text_deltas_out: counters.textDeltasOut,
              live_model: liveState.liveModel,
              voice_name: liveState.voiceName,
            }
          );
          sendListeningReady('welcome_timeout');
        }, WELCOME_TURN_TIMEOUT_MS);
        sendJson(ws, {
          type: 'welcome_started',
          text: liveState.welcomeMessage,
          timeout_ms: WELCOME_TURN_TIMEOUT_MS,
          session_id: sessionId,
        });
        return;
      }

      if (!liveState.awaitingWelcomeComplete) {
        sendListeningReady(source);
      }
    };

    // Tunable. 3 attempts is enough to ride through transient Google
    // backend hiccups without infinite-looping when the model itself is
    // permanently broken for the project.
    const MAX_RESUME_ATTEMPTS = Number(
      process.env.JURINEX_VOICE_LIVE_MAX_RESUMES || 3
    );

    const handleGeminiMessage = (message) => {
      // Stash the latest session-resumption handle BEFORE the kind filter
      // so we always have one ready when a 1011 fires mid-conversation.
      if (message?.sessionResumptionUpdate?.newHandle && liveState) {
        liveState.lastResumeHandle = message.sessionResumptionUpdate.newHandle;
      }
      const kind = messageKind(message);
      // One-line trace per server message so we can see exactly what
      // Gemini emitted (and in what order) right before any 1008 close.
      if (kind !== 'sessionResumptionUpdate') {
        console.log('[JURINEX_VOICE_LIVE_MSG]', {
          sessionId,
          agentId,
          tMs: sinceConn(),
          kind,
          counters: {
            in: counters.audioPacketsIn,
            out: counters.audioChunksOut,
            txOut: counters.textDeltasOut,
            inTr: counters.inputTranscripts,
            outTr: counters.outputTranscripts,
          },
        });
      }

      if (message?.setupComplete) {
        modelReady = true;
        sendJson(ws, { type: 'model_ready', session_id: sessionId });
        pipeline('setup_complete', {
          latency_from_socket_open_ms: sinceStage('session_open'),
        });
        advanceLiveConversation('setup_complete');
      }

      if (message?.toolCall) {
        const calls = message.toolCall.functionCalls || [];
        const fnNames = calls.map((c) => c?.name).filter(Boolean);
        pipeline('tool_call_received', {
          function_names: fnNames,
          ack_strategy: 'real_dispatcher',
        });
        // Per the Live API docs, every toolCall MUST be answered with a
        // toolResponse — otherwise Gemini Live closes 1008 mid-turn.
        // Hand off to the real dispatcher (tools/dispatcher.js); the
        // promise chain runs after handleGeminiMessage returns so we
        // never block subsequent server frames.
        void (async () => {
          const functionResponses = [];
          for (const call of calls) {
            const result = await toolDispatcher
              .execute({
                name: call?.name,
                args: call?.args || {},
                sessionId,
                agentId,
                traceId: liveState?.traceId,
                functionCallId: call?.id,
                toolSettings: liveState?.toolSettings || {},
                transferConfig: liveState?.transferConfig || {},
                endSession: ({ reason, farewell, source, transfer, agentTransfer }) => {
                  scheduleSessionEnd({
                    reason: reason || 'tool_request',
                    farewell,
                    source: source || 'tool',
                    transfer,
                    agentTransfer,
                  });
                },
                bridgeTwilioCall: liveState?.bridgeTwilioCall || null,
              })
              .catch((err) => ({
                status: 'dispatcher_exception',
                detail: err && err.message ? err.message : String(err),
              }));
            functionResponses.push({
              id: call?.id,
              name: call?.name,
              response: { result },
            });
          }
          try {
            if (typeof geminiSession?.sendToolResponse === 'function') {
              geminiSession.sendToolResponse({ functionResponses });
            } else if (typeof geminiSession?.sendClientContent === 'function') {
              geminiSession.sendClientContent({
                turns: [
                  {
                    role: 'function',
                    parts: functionResponses.map((fr) => ({ functionResponse: fr })),
                  },
                ],
                turnComplete: false,
              });
            }
            pipeline('tool_response_sent', {
              function_count: functionResponses.length,
              function_names: fnNames,
              statuses: functionResponses.map((fr) => fr.response?.result?.status || 'ok'),
            });
          } catch (err) {
            pipeline('tool_response_failed', {
              error: err && err.message,
              function_names: fnNames,
            });
          }
        })();
      }

      if (message?.goAway) {
        pipeline('go_away', {
          time_left: message.goAway.timeLeft,
          reason: message.goAway.reason || null,
        });
      }

      const inputTranscript = extractTranscriptText(message?.serverContent?.inputTranscription);
      if (inputTranscript) {
        if (counters.inputTranscripts === 0) {
          pipeline('input_transcript_first', {
            text_preview: String(inputTranscript).slice(0, 80),
            latency_from_first_mic_ms: sinceStage('mic_first_packet'),
          });
        }
        lastInputTranscript = inputTranscript;
        pendingInputTranscript = inputTranscript;
        counters.inputTranscripts += 1;
        sendJson(ws, {
          type: 'input_transcript',
          text: inputTranscript,
          final: Boolean(message?.serverContent?.turnComplete),
          session_id: sessionId,
        });
      }

      const outputTranscript = extractTranscriptText(message?.serverContent?.outputTranscription);
      if (outputTranscript) {
        if (counters.outputTranscripts === 0) {
          pipeline('output_transcript_first', {
            text_preview: String(outputTranscript).slice(0, 80),
          });
        }
        counters.outputTranscripts += 1;
        // Gemini sends partial deltas; concatenate until a turnComplete /
        // generationComplete frame, then commit the full agent turn to
        // the post-call transcript accumulator.
        pendingOutputTranscript = `${pendingOutputTranscript || ''}${outputTranscript}`;
        sendJson(ws, {
          type: 'output_transcript',
          text: outputTranscript,
          final: Boolean(message?.serverContent?.generationComplete || message?.serverContent?.turnComplete),
          session_id: sessionId,
        });
      }

      const isTurnFinal =
        Boolean(message?.serverContent?.turnComplete) ||
        Boolean(message?.serverContent?.generationComplete);
      if (isTurnFinal) {
        if (pendingInputTranscript) {
          transcriptTurns.push({
            role: 'user',
            text: pendingInputTranscript,
            ts: new Date().toISOString(),
          });
          pendingInputTranscript = '';
        }
        if (pendingOutputTranscript) {
          transcriptTurns.push({
            role: 'agent',
            text: pendingOutputTranscript,
            ts: new Date().toISOString(),
          });
          pendingOutputTranscript = '';
        }
      }

      const text = extractLiveTextParts(message);
      if (text) {
        if (counters.textDeltasOut === 0) {
          pipeline('text_delta_first', { text_preview: String(text).slice(0, 80) });
        }
        counters.textDeltasOut += 1;
        sendJson(ws, { type: 'text_delta', text, session_id: sessionId });
      }

      const audioParts = extractLiveAudioParts(message);
      for (const part of audioParts) {
        const byteLength = Buffer.byteLength(part.data, 'base64');
        counters.audioChunksOut += 1;
        counters.audioBytesOut += byteLength;
        sendJson(ws, {
          type: 'audio_chunk',
          data: part.data,
          mime_type: part.mime_type,
          index: counters.audioChunksOut,
          byte_length: byteLength,
          session_id: sessionId,
        });
        if (counters.audioChunksOut === 1) {
          pipeline('audio_out_first', {
            byte_length: byteLength,
            mime_type: part.mime_type,
            latency_from_setup_ms: sinceStage('setup_complete'),
            latency_from_welcome_ms: sinceStage('welcome_sent'),
            latency_from_first_mic_ms: sinceStage('mic_first_packet'),
          });
        }
        if (counters.audioChunksOut === 1 || counters.audioChunksOut % 20 === 0) {
          console.log('[JURINEX_VOICE_LIVE] audio chunk streamed to browser', {
            sessionId,
            agentId,
            chunkIndex: counters.audioChunksOut,
            byteLength,
            mimeType: part.mime_type,
          });
        }
      }

      if (message?.serverContent?.interrupted) {
        pipeline('interrupted', { audio_chunks_so_far: counters.audioChunksOut });
        sendJson(ws, { type: 'interrupted', session_id: sessionId });
      }

      if (message?.serverContent?.generationComplete || message?.serverContent?.turnComplete) {
        if (!pipelineTimes.turn_complete_first) {
          pipeline('turn_complete_first', {
            audio_chunks_total: counters.audioChunksOut,
            audio_bytes_total: counters.audioBytesOut,
            latency_from_setup_ms: sinceStage('setup_complete'),
          });
        }
        sendJson(ws, {
          type: 'turn_complete',
          generation_complete: Boolean(message?.serverContent?.generationComplete),
          turn_complete: Boolean(message?.serverContent?.turnComplete),
          session_id: sessionId,
        });
        if (liveState?.awaitingWelcomeComplete) {
          liveState.awaitingWelcomeComplete = false;
          sendListeningReady('welcome_turn_complete');
        }
      }
    };

    const startGeminiSession = async (payload) => {
      if (setupStarted) return;
      setupStarted = true;

      const agent = await agentRepo.getById(agentId);
      if (!agent) {
        const err = new Error('Agent not found for live voice test.');
        err.statusCode = 404;
        throw err;
      }

      const builderSettings = payload.builder_settings || {};
      const selectedLanguages = builderSettings.languages || payload.selected_languages || [];
      const languageCode = agentTest.normalizeLanguageCode(payload.language_code, selectedLanguages);
      // When the agent is in multilingual mode (only 'multi' selected,
      // or no specific language pinned), the {{language_label}} the
      // model sees should say "Multilingual" so it auto-detects the
      // caller's language instead of locking to a single one.
      const isMultilingualMode =
        Array.isArray(selectedLanguages) &&
        selectedLanguages.length > 0 &&
        selectedLanguages.every((item) => !item || item === 'multi');
      const languageLabel = isMultilingualMode
        ? 'Multilingual (auto-detect — reply in the same language the caller speaks: English, Hindi, Marathi, or any other)'
        : agentTest.LANGUAGE_LABELS[languageCode] || languageCode;
      const liveModel = agentTest.resolveConversationModel(payload.live_model || DEFAULT_LIVE_MODEL);
      const liveModelPath = toLiveModelPath(liveModel);
      const voiceName = payload.voice_name || 'Puck';
      const welcomeMessage = String(payload.welcome_message || '').trim();
      const shouldSpeakFirst = payload.speaker !== 'user_first' && welcomeMessage;
      const ai = agentTest.createClient({
        httpOptions: {
          apiVersion: process.env.JURINEX_VOICE_LIVE_API_VERSION || 'v1beta',
        },
      });
      // Fetch per-agent transfer + tool settings so the dispatcher
      // knows the destination phone, calendar id, etc.
      const agentConfig = await agentConfigRepo.get(agentId).catch(() => null);
      const transferConfig = agentConfig?.transfer_call || {};
      // tool_settings can live in three places; preferred location is
      // custom_settings.agent_builder.tool_settings (saved through the
      // existing builder save flow). Fall back to legacy paths for
      // backward compatibility.
      const toolSettings =
        agentConfig?.custom_settings?.agent_builder?.tool_settings ||
        agentConfig?.custom_settings?.tool_settings ||
        agentConfig?.tool_settings ||
        {};

      // Resolve which tools the model is allowed to call from
      // builder_settings.functions[]. Auto-enable
      // `search_knowledge_base` whenever the agent has KB docs selected
      // so the model has a way to retrieve chunks at conversation time
      // (matches the "Tool first, speech after" rule in agent prompts).
      const docIds = Array.isArray(builderSettings.knowledge_base?.document_ids)
        ? builderSettings.knowledge_base.document_ids.filter(Boolean)
        : [];
      const enabledFunctionKeys = (builderSettings.functions || [])
        .filter((fn) => fn && fn.enabled !== false)
        .map((fn) => fn.key)
        .filter(Boolean);
      if (docIds.length && !enabledFunctionKeys.includes('search_knowledge_base')) {
        enabledFunctionKeys.push('search_knowledge_base');
      }
      const useKbSearchTool = enabledFunctionKeys.includes('search_knowledge_base');

      // When the model has the search tool, fetch chunks on demand at
      // query time (low latency, focused context). Otherwise fall back
      // to dumping the entire KB into the system prompt.
      const knowledgeBase = useKbSearchTool
        ? { sections: [], totalBytes: 0, truncated: false }
        : await fetchKnowledgeBaseContext(docIds).catch((err) => {
            voiceLogger.warn('live voice test KB fetch failed', {
              summary: { agentId, error: err.message },
            });
            return { sections: [], totalBytes: 0, truncated: false };
          });
      const functionDeclarations = toolDeclarations.getDeclarationsForAgent(enabledFunctionKeys);
      console.log('[JURINEX_VOICE_LIVE] tool declarations resolved', {
        sessionId,
        agentId,
        enabledFunctionKeys,
        declared: functionDeclarations.map((d) => d.name),
      });
      const systemInstruction = await buildLiveSystemInstruction({
        audioPrompt: payload.audio_prompt,
        languageLabel,
        knowledgeBase,
        enabledFunctionKeys,
        calendarSettings: toolSettings?.calendar || {},
        transferConfig,
      });
      console.log('[JURINEX_VOICE_LIVE] knowledge base loaded for live session', {
        sessionId,
        agentId,
        documentCount: knowledgeBase.sections.length,
        bytes: knowledgeBase.totalBytes,
        truncated: knowledgeBase.truncated,
        budgetBytes: KNOWLEDGE_BASE_BUDGET_BYTES,
      });
      // Pre-render the welcome turn template from the DB-stored fragment
      // (voice_system_prompt_fragments / welcome_turn_template). Cached
      // here so the sync advanceLiveConversation() doesn't need to await.
      const welcomePromptTemplate = welcomeMessage
        ? await promptFragments
            .renderFragment('welcome_turn_template', {
              language_label: languageLabel,
              welcome_message: welcomeMessage,
            })
            .catch(() => '')
        : '';

      liveState = {
        liveModel,
        voiceName,
        languageCode,
        languageLabel,
        audioPrompt: payload.audio_prompt,
        builderSettings,
        history: Array.isArray(payload.history) ? payload.history : [],
        shouldSpeakFirst: Boolean(shouldSpeakFirst),
        welcomeMessage,
        welcomePromptTemplate,
        welcomeSent: false,
        awaitingWelcomeComplete: false,
        listeningReadySent: false,
        welcomeTimer: null,
        transferConfig,
        toolSettings,
        enabledFunctionKeys,
        functionDeclarations,
        traceId: payload.trace_id || null,
        endingScheduled: false,
      };
      geminiClosed = false;
      modelReady = false;

      const selectedKey =
        process.env.JURINEX_VOICE_TEST_GOOGLE_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.JURINEX_VOICE_PREVIEW_GOOGLE_API_KEY ||
        '';
      console.log('[JURINEX_VOICE_LIVE] starting Gemini Live session', {
        sessionId,
        agentId,
        liveModel,
        liveModelPath,
        voiceName,
        languageCode,
        adminActor: auth?.method || 'unknown',
        browserMimeType: payload.input_mime_type || INPUT_AUDIO_MIME_TYPE,
        welcomeEnabled: Boolean(shouldSpeakFirst),
        apiKeyPrefix: selectedKey ? `${selectedKey.slice(0, 6)}…(${selectedKey.length} chars)` : 'NONE',
      });

      await logLifecycle(
        'agent_test_live_socket_started',
        'live_test_socket',
        'Realtime voice test socket started',
        {
          live_model: liveModel,
          voice_name: voiceName,
          language_code: languageCode,
          input_mime_type: payload.input_mime_type || INPUT_AUDIO_MIME_TYPE,
          welcome_enabled: Boolean(shouldSpeakFirst),
        }
      );

      // Single source of truth for the Gemini Live config. Used by the
      // initial connect and by every subsequent auto-resume after 1011.
      const buildLiveConfig = (resumeHandle) => ({
        responseModalities: [Modality.AUDIO],
        systemInstruction,
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
        thinkingConfig: { thinkingLevel: 'minimal' },
        ...(functionDeclarations.length ? { tools: [{ functionDeclarations }] } : {}),
        contextWindowCompression: {
          triggerTokens: 104857,
          slidingWindow: { targetTokens: 52428 },
        },
        // Empty {} on first connect opts the session into receiving
        // sessionResumptionUpdate frames; on resume we pass the latest
        // handle so the model rebuilds prior context.
        sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
      });

      const connectGemini = async (resumeHandle = null) => {
        return ai.live.connect({
          model: liveModelPath,
          callbacks: {
            onopen: () => {
              pipeline(resumeHandle ? 'gemini_socket_resumed' : 'gemini_socket_open', {
                live_model: liveModel,
                live_model_path: liveModelPath,
                voice_name: voiceName,
                language_code: languageCode,
                resume_handle_present: Boolean(resumeHandle),
                resume_attempts: liveState?.resumeAttempts || 0,
              });
              sendJson(ws, {
                type: resumeHandle ? 'model_socket_resumed' : 'model_socket_open',
                session_id: sessionId,
                live_model: liveModel,
                live_model_path: liveModelPath,
                language_code: languageCode,
                voice_name: voiceName,
                resume_attempt: liveState?.resumeAttempts || 0,
              });
            },
            onmessage: handleGeminiMessage,
            onerror: (event) => {
            const error = event?.error || event;
            const summary = summarizeError(error);
            pipeline('gemini_error', {
              error_name: summary.name,
              error_message: summary.message,
              error_code: summary.code,
              counters,
            });
            console.error('[JURINEX_VOICE_LIVE] Gemini Live error', {
              sessionId,
              agentId,
              ...summary,
            });
            sendJson(ws, { type: 'error', message: summary.message, error: summary, session_id: sessionId });
            logLifecycle(
              'agent_test_live_socket_failed',
              'live_test_socket',
              'Gemini Live socket error',
              {
                live_model: liveModel,
                voice_name: voiceName,
                language_code: languageCode,
                error: summary.message,
                counters,
              }
            );
          },
          onclose: (event) => {
            const code = event?.code || null;
            const reason = event?.reason || null;
            geminiClosed = true;
            geminiSession = null;
            const breakStage = !modelReady
              ? 'before_setup_complete'
              : !pipelineTimes.welcome_sent && liveState?.shouldSpeakFirst
                ? 'before_welcome_sent'
                : counters.audioChunksOut === 0 && pipelineTimes.welcome_sent
                  ? 'after_welcome_sent_no_audio_out'
                  : counters.audioChunksOut === 0
                    ? 'after_setup_no_audio_out'
                    : counters.audioPacketsIn > 0 && pipelineTimes.audio_out_first
                      ? 'mid_conversation'
                      : 'after_first_audio_out';
            pipeline('gemini_socket_close', {
              close_code: code,
              close_reason: reason,
              break_stage: breakStage,
              model_ready: modelReady,
              counters: { ...counters },
              latency_from_session_open_ms: sinceConn(),
              latency_from_setup_ms: sinceStage('setup_complete'),
              latency_from_first_mic_ms: sinceStage('mic_first_packet'),
              hint:
                code === 1008
                  ? 'WS 1008 typically means a request was made that the model/session does not support: invalid voice, missing tools declaration, or preview-tier audio not enabled. Compare against the prior 2.5-native-audio session that succeeded.'
                  : null,
              // Snapshot of the timeline so far (cloned to avoid the
              // self-reference circular-JSON crash that killed the server).
              timeline: pipelineMarks.map((m) => ({ stage: m.stage, t_ms: m.t_ms })),
            });
            console.log('[JURINEX_VOICE_LIVE] Gemini Live socket closed', {
              sessionId,
              agentId,
              code,
              reason,
              modelReady,
              counters,
              breakStage,
            });

            // ── AUTO-RESUME ON 1011 ────────────────────────────────────
            // Gemini Live native-audio sometimes returns WS 1011
            // "Internal error occurred." mid-conversation (most often
            // right after an `interrupted` event). If the model already
            // gave us a resumption handle and the session was actually
            // productive, transparently reconnect with that handle so
            // the conversation continues with full prior context.
            const canResume =
              code === 1011 &&
              Boolean(liveState?.lastResumeHandle) &&
              counters.audioChunksOut > 0 &&
              (liveState.resumeAttempts || 0) < MAX_RESUME_ATTEMPTS &&
              !closed &&
              !liveState?.endingScheduled;
            if (canResume) {
              const attempt = (liveState.resumeAttempts || 0) + 1;
              liveState.resumeAttempts = attempt;
              const handle = liveState.lastResumeHandle;
              pipeline('gemini_session_resuming', {
                attempt,
                max_attempts: MAX_RESUME_ATTEMPTS,
                handle_present: true,
                trigger: 'ws_1011',
              });
              sendJson(ws, {
                type: 'model_resuming',
                attempt,
                max_attempts: MAX_RESUME_ATTEMPTS,
                session_id: sessionId,
              });
              setTimeout(() => {
                if (closed || liveState?.endingScheduled) return;
                connectGemini(handle)
                  .then((session) => {
                    geminiSession = session;
                    geminiClosed = false;
                  })
                  .catch((err) => {
                    pipeline('gemini_session_resume_failed', {
                      attempt,
                      error: err && err.message ? err.message : String(err),
                    });
                    sendJson(ws, {
                      type: 'model_resume_failed',
                      attempt,
                      error: err && err.message ? err.message : String(err),
                      session_id: sessionId,
                    });
                  });
              }, 500).unref?.();
              return;
            }

            sendJson(ws, {
              type: 'model_socket_closed',
              code,
              reason,
              fatal: code !== 1000,
              unsupported: code === 1008 || /not implemented|not supported|not enabled/i.test(String(reason || '')),
              session_id: sessionId,
            });
            if (code !== 1000 && counters.audioChunksOut === 0) {
              sendJson(ws, {
                type: 'error',
                message:
                  'Gemini Live closed before returning audio. Live-only mode is enabled, so no fallback was used.',
                code,
                reason,
                last_input_transcript: lastInputTranscript,
                session_id: sessionId,
              });
              void logLifecycle(
                'agent_test_live_socket_closed_without_audio',
                'live_test_socket',
                'Gemini Live closed before audio output',
                {
                  close_code: code,
                  close_reason: reason,
                  live_model: liveModel,
                  live_model_path: liveModelPath,
                  voice_name: voiceName,
                  language_code: languageCode,
                  last_input_transcript: lastInputTranscript,
                  counters,
                }
              );
            }
          },
        },
          config: buildLiveConfig(resumeHandle),
        });
      };

      // Initial connect (no resume handle).
      geminiSession = await connectGemini(null);

      sendJson(ws, {
        type: 'session_started',
        session_id: sessionId,
        live_model: liveModel,
        live_model_path: liveModelPath,
        language_code: languageCode,
        voice_name: voiceName,
        input_mime_type: INPUT_AUDIO_MIME_TYPE,
      });

      advanceLiveConversation('connect_returned');
    };

    sendJson(ws, {
      type: 'socket_ready',
      session_id: sessionId,
      input_mime_type: INPUT_AUDIO_MIME_TYPE,
    });

    console.log('[JURINEX_VOICE_LIVE] browser socket connected', {
      sessionId,
      agentId,
      adminActor: auth?.method || 'unknown',
      ip: req.socket?.remoteAddress || null,
    });
    pipeline('browser_socket_open', {
      admin_actor: auth?.method || 'unknown',
      ip: req.socket?.remoteAddress || null,
    });

    ws.on('message', async (raw) => {
      const packet = typeof raw === 'string' ? raw : raw.toString('utf8');
      const message = safeJson(packet);
      if (!message?.type) {
        sendJson(ws, { type: 'error', message: 'Invalid live test socket packet.', session_id: sessionId });
        return;
      }

      try {
        if (message.type === 'start') {
          await startGeminiSession(message);
          return;
        }

        if (message.type === 'audio_chunk') {
          if (!geminiSession || geminiClosed) {
            if (counters.audioPacketsIn === 0 || counters.audioPacketsIn % 100 === 0) {
              console.warn('[JURINEX_VOICE_LIVE] dropping browser audio packet because Gemini is not open', {
                sessionId,
                agentId,
                geminiClosed,
                hasSession: Boolean(geminiSession),
              });
            }
            return;
          }
          if (!message.data) return;
          const mimeType = message.mime_type || message.mimeType || INPUT_AUDIO_MIME_TYPE;
          const byteLength = Buffer.byteLength(message.data, 'base64');
          counters.audioPacketsIn += 1;
          counters.audioBytesIn += byteLength;
          if (counters.audioPacketsIn === 1) {
            pipeline('mic_first_packet', {
              byte_length: byteLength,
              mime_type: mimeType,
              latency_from_listening_ready_ms: sinceStage('listening_ready'),
            });
          }
          geminiSession.sendRealtimeInput({
            audio: {
              data: message.data,
              mimeType,
            },
          });
          if (counters.audioPacketsIn === 1 || counters.audioPacketsIn % 50 === 0) {
            console.log('[JURINEX_VOICE_LIVE] browser audio packet forwarded to Gemini', {
              sessionId,
              agentId,
              packetIndex: counters.audioPacketsIn,
              byteLength,
              mimeType,
            });
          }
          return;
        }

        if (message.type === 'stop_audio') {
          geminiSession?.sendRealtimeInput?.({ audioStreamEnd: true });
          return;
        }

        if (message.type === 'end') {
          closeGemini();
          closeSocket(1000, 'Live voice test ended');
        }
      } catch (err) {
        const summary = summarizeError(err);
        console.error('[JURINEX_VOICE_LIVE] browser packet handling failed', {
          sessionId,
          agentId,
          packetType: message.type,
          ...summary,
        });
        sendJson(ws, { type: 'error', message: summary.message, error: summary, session_id: sessionId });
        await logLifecycle(
          'agent_test_live_socket_failed',
          'live_test_socket',
          'Realtime voice test socket packet failed',
          {
            packet_type: message.type,
            error: summary.message,
            counters,
          }
        );
      }
    });

    ws.on('close', (code, reasonBuffer) => {
      if (closed) return;
      closed = true;
      const reason = reasonBuffer?.toString?.() || '';
      closeGemini();
      // Flush any in-progress turn before extraction so the last words
      // aren't lost if the caller hung up mid-utterance.
      if (pendingInputTranscript) {
        transcriptTurns.push({
          role: 'user',
          text: pendingInputTranscript,
          ts: new Date().toISOString(),
        });
        pendingInputTranscript = '';
      }
      if (pendingOutputTranscript) {
        transcriptTurns.push({
          role: 'agent',
          text: pendingOutputTranscript,
          ts: new Date().toISOString(),
        });
        pendingOutputTranscript = '';
      }
      pipeline('browser_socket_close', {
        close_code: code,
        close_reason: reason,
        duration_ms: Date.now() - connectedAt,
        counters,
        transcript_turns: transcriptTurns.length,
        timeline: pipelineMarks.map((m) => ({ stage: m.stage, t_ms: m.t_ms })),
      });
      console.log('[JURINEX_VOICE_LIVE] browser socket closed', {
        sessionId,
        agentId,
        code,
        reason,
        durationMs: Date.now() - connectedAt,
        counters,
      });

      // Fire the post-call extraction job. Fully fire-and-forget so a
      // slow Gemini call never holds the WS handler open.
      const fieldList =
        liveState?.builderSettings?.post_call_extraction ||
        [];
      const postCallModel =
        liveState?.builderSettings?.post_call_model || undefined;
      void postCallExtractor
        .runExtraction({
          sessionId,
          agentId,
          agentName: liveState?.builderSettings?.agent_name || null,
          transcriptTurns: [...transcriptTurns],
          fieldList,
          model: postCallModel,
        })
        .catch((err) => {
          voiceLogger.warn('post_call_extraction failed', {
            summary: { sessionId, agentId, error: err.message },
          });
        });
      logLifecycle(
        'agent_test_live_socket_closed',
        'live_test_socket',
        'Realtime voice test socket closed',
        {
          close_code: code,
          close_reason: reason,
          duration_ms: Date.now() - connectedAt,
          counters,
        }
      );
    });

    ws.on('error', (err) => {
      const summary = summarizeError(err);
      console.error('[JURINEX_VOICE_LIVE] browser socket error', {
        sessionId,
        agentId,
        ...summary,
      });
    });
  });

  console.log('[JURINEX_VOICE_LIVE] WebSocket bridge attached', {
    paths: [
      '/admin/jurinex-voice/agents/:agentId/live-test',
      '/api/admin/jurinex-voice/agents/:agentId/live-test',
    ],
  });

  return wss;
};

module.exports = {
  attachAgentLiveTestSocket,
};
