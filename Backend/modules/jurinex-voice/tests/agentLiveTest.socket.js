const { randomUUID } = require('crypto');
const jwt = require('jsonwebtoken');
const { MediaResolution, Modality } = require('@google/genai');
const { WebSocketServer, WebSocket } = require('ws');

const { JWT_SECRET } = require('../../../config/env');
const agentRepo = require('../agents/voiceAgent.repository');
const kbRepo = require('../kb/kb.repository');
const dataflow = require('../observability/dataflowLogger');
const voiceLogger = require('../observability/voiceLogger');
const agentTest = require('./agentTest.service');

const LIVE_TEST_PATH_RE =
  /^\/(?:api\/)?admin\/jurinex-voice\/agents\/([^/]+)\/live-test\/?$/;

const DEFAULT_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const INPUT_AUDIO_MIME_TYPE = 'audio/pcm;rate=16000';
const OUTPUT_AUDIO_MIME_TYPE = 'audio/L16;rate=24000';
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

const formatKnowledgeBaseBlock = (kb) => {
  if (!kb || !kb.sections.length) return '';
  const blocks = kb.sections.map(
    (section, idx) => `### Document ${idx + 1}: ${section.title}\n${section.body}`
  );
  return [
    '---',
    'KNOWLEDGE BASE (the only source of truth for product/policy questions):',
    blocks.join('\n\n'),
    kb.truncated ? '[Note: knowledge base content was truncated due to size budget.]' : '',
    '---',
    'Rules for using the knowledge base above:',
    '- Answer product/policy/feature questions ONLY from the knowledge base content above.',
    '- If the answer is not present in the knowledge base, say so plainly in the caller\'s language and offer to transfer or take a callback. Do not invent facts.',
    '- Quote document titles or sections naturally when helpful, but never read raw markdown or section markers.',
    '- For account-specific or out-of-scope requests, follow the agent prompt\'s transfer policy.',
  ]
    .filter(Boolean)
    .join('\n');
};

const buildLiveSystemInstruction = ({ audioPrompt, languageLabel, knowledgeBase }) =>
  [
    agentTest.buildSystemInstruction({ audioPrompt, languageLabel }),
    '',
    'This is a realtime phone-call style audio session.',
    'Listen continuously, answer as soon as the caller finishes a thought, and allow interruption if the caller starts speaking again.',
    'Keep the same selected language unless the caller clearly asks to switch.',
    'Do not describe internal settings, test mode, or streaming mechanics.',
    formatKnowledgeBaseBlock(knowledgeBase),
  ]
    .filter(Boolean)
    .join('\n');

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
      console.log('[JURINEX_VOICE_LIVE] listening ready sent to browser', {
        sessionId,
        agentId,
        reason,
        welcomeSent: Boolean(liveState.welcomeSent),
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
        console.log('[JURINEX_VOICE_LIVE] sending AI-first welcome turn to Gemini', {
          sessionId,
          agentId,
          source,
          welcomePreview: liveState.welcomeMessage.slice(0, 120),
        });
        geminiSession.sendClientContent({
          turns: [
            `Start the call now by saying this greeting naturally in ${liveState.languageLabel}: ${liveState.welcomeMessage}`,
          ],
          turnComplete: true,
        });
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

    const handleGeminiMessage = (message) => {
      if (message?.setupComplete) {
        modelReady = true;
        sendJson(ws, { type: 'model_ready', session_id: sessionId });
        console.log('[JURINEX_VOICE_LIVE] Gemini Live setup complete', {
          sessionId,
          agentId,
        });
        advanceLiveConversation('setup_complete');
      }

      const inputTranscript = extractTranscriptText(message?.serverContent?.inputTranscription);
      if (inputTranscript) {
        lastInputTranscript = inputTranscript;
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
        counters.outputTranscripts += 1;
        sendJson(ws, {
          type: 'output_transcript',
          text: outputTranscript,
          final: Boolean(message?.serverContent?.generationComplete || message?.serverContent?.turnComplete),
          session_id: sessionId,
        });
      }

      const text = extractLiveTextParts(message);
      if (text) {
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
        sendJson(ws, { type: 'interrupted', session_id: sessionId });
      }

      if (message?.serverContent?.generationComplete || message?.serverContent?.turnComplete) {
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
      const languageLabel = agentTest.LANGUAGE_LABELS[languageCode] || languageCode;
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
      const knowledgeBase = await fetchKnowledgeBaseContext(
        builderSettings.knowledge_base?.document_ids
      ).catch((err) => {
        voiceLogger.warn('live voice test KB fetch failed', {
          summary: { agentId, error: err.message },
        });
        return { sections: [], totalBytes: 0, truncated: false };
      });
      const systemInstruction = buildLiveSystemInstruction({
        audioPrompt: payload.audio_prompt,
        languageLabel,
        knowledgeBase,
      });
      console.log('[JURINEX_VOICE_LIVE] knowledge base loaded for live session', {
        sessionId,
        agentId,
        documentCount: knowledgeBase.sections.length,
        bytes: knowledgeBase.totalBytes,
        truncated: knowledgeBase.truncated,
        budgetBytes: KNOWLEDGE_BASE_BUDGET_BYTES,
      });
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
        welcomeSent: false,
        awaitingWelcomeComplete: false,
        listeningReadySent: false,
        welcomeTimer: null,
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

      geminiSession = await ai.live.connect({
        model: liveModelPath,
        callbacks: {
          onopen: () => {
            sendJson(ws, {
              type: 'model_socket_open',
              session_id: sessionId,
              live_model: liveModel,
              live_model_path: liveModelPath,
              language_code: languageCode,
              voice_name: voiceName,
            });
          },
          onmessage: handleGeminiMessage,
          onerror: (event) => {
            const error = event?.error || event;
            const summary = summarizeError(error);
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
            console.log('[JURINEX_VOICE_LIVE] Gemini Live socket closed', {
              sessionId,
              agentId,
              code,
              reason,
              modelReady,
              counters,
            });
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
        config: {
          responseModalities: [Modality.AUDIO],
          mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
          systemInstruction,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
          contextWindowCompression: {
            triggerTokens: 104857,
            slidingWindow: { targetTokens: 52428 },
          },
        },
      });

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
      console.log('[JURINEX_VOICE_LIVE] browser socket closed', {
        sessionId,
        agentId,
        code,
        reason,
        durationMs: Date.now() - connectedAt,
        counters,
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
