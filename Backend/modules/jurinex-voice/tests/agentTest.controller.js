/**
 * HTTP controller for the browser-based voice agent test conversation.
 */
const agentRepo = require('../agents/voiceAgent.repository');
const agentTest = require('./agentTest.service');
const dataflow = require('../observability/dataflowLogger');
const voiceLogger = require('../observability/voiceLogger');

const parseJsonField = (value, fallback) => {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const writeSse = (res, event, data) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

const runTurn = async (req, res) => {
  const { agentId } = req.params;
  try {
    const agent = await agentRepo.getById(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: { message: 'Agent not found' } });
    }

    const {
      live_model,
      voice_name,
      audio_prompt,
      builder_settings = {},
      language_code,
      history = [],
      user_text,
    } = req.body || {};

    const cleanUserText = String(user_text || '').trim();
    if (!cleanUserText) {
      return res.status(400).json({
        success: false,
        error: { message: 'user_text is required for the agent test turn.' },
      });
    }

    await dataflow.logAgentBuilderEvent({
      event_type: 'agent_test_turn_requested',
      stage: 'test_audio',
      message: 'Browser voice test turn requested',
      agent_id: agentId,
      payload: {
        request_id: req.requestId,
        live_model,
        voice_name,
        language_code,
        user_text_preview: cleanUserText.slice(0, 120),
        history_count: Array.isArray(history) ? history.length : 0,
      },
    });

    const reply = await agentTest.generateAgentReply({
      liveModel: live_model,
      voiceName: voice_name,
      audioPrompt: audio_prompt,
      builderSettings: builder_settings,
      languageCode: language_code,
      history,
      userText: cleanUserText,
    });

    await dataflow.logAgentBuilderEvent({
      event_type: 'agent_test_turn_completed',
      stage: 'test_audio',
      message: 'Browser voice test turn completed',
      agent_id: agentId,
      payload: {
        request_id: req.requestId,
        live_model,
        voice_name,
        language_code: reply.language_code,
        generation_model: reply.generation_model,
        audio_generation_model: reply.audio_generation_model,
        audio_ready: Boolean(reply.reply_audio_base64),
        audio_error: reply.audio_error,
        live_fallback_reason: reply.live_fallback_reason,
        reply_preview: reply.reply_text.slice(0, 160),
      },
    });

    return res.json({
      success: true,
      reply,
    });
  } catch (err) {
    voiceLogger.errorWithContext('runAgentTestTurn failed', err, {
      requestId: req.requestId,
      agentId,
    });

    await dataflow.logAgentBuilderEvent({
      event_type: 'agent_test_turn_failed',
      stage: 'test_audio',
      message: 'Browser voice test turn failed',
      agent_id: agentId,
      payload: {
        request_id: req.requestId,
        error: err.message,
      },
    });

    return res.status(502).json({
      success: false,
      error: { message: err.message || 'Agent test turn failed.' },
    });
  }
};

const runAudioTurn = async (req, res) => {
  const { agentId } = req.params;
  const startedAt = Date.now();
  try {
    const agent = await agentRepo.getById(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: { message: 'Agent not found' } });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({
        success: false,
        error: { message: 'audio file is required for the agent test audio turn.' },
      });
    }

    const {
      live_model,
      voice_name,
      audio_prompt,
      language_code,
    } = req.body || {};
    const builderSettings = parseJsonField(req.body?.builder_settings, {});
    const history = parseJsonField(req.body?.history, []);
    const audioMimeType = req.file.mimetype || req.body?.audio_mime_type || 'audio/webm';

    console.log('[JURINEX_VOICE_TEST] audio turn received', {
      requestId: req.requestId,
      agentId,
      live_model,
      voice_name,
      language_code,
      audioMimeType,
      audioBytes: req.file.size || req.file.buffer.length,
      historyCount: Array.isArray(history) ? history.length : 0,
    });

    await dataflow.logAgentBuilderEvent({
      event_type: 'agent_test_audio_turn_received',
      stage: 'test_audio_upload',
      message: 'Browser microphone audio received for agent test',
      agent_id: agentId,
      payload: {
        request_id: req.requestId,
        live_model,
        voice_name,
        language_code,
        audio_mime_type: audioMimeType,
        audio_bytes: req.file.size || req.file.buffer.length,
        history_count: Array.isArray(history) ? history.length : 0,
      },
    });

    const reply = await agentTest.generateAgentReplyFromAudio({
      liveModel: live_model,
      voiceName: voice_name,
      audioPrompt: audio_prompt,
      builderSettings,
      languageCode: language_code,
      history,
      audioBuffer: req.file.buffer,
      audioMimeType,
    });

    console.log('[JURINEX_VOICE_TEST] audio turn completed', {
      requestId: req.requestId,
      agentId,
      fastPath: Boolean(reply.fast_path),
      transcriptionModel: reply.transcription_model,
      generationModel: reply.generation_model,
      audioSkippedOrError: reply.audio_error || null,
      timings: reply.timings || {},
      totalRequestMs: Date.now() - startedAt,
    });

    await dataflow.logAgentBuilderEvent({
      event_type: 'agent_test_audio_turn_completed',
      stage: 'test_audio_reply',
      message: 'Browser microphone audio test turn completed',
      agent_id: agentId,
      payload: {
        request_id: req.requestId,
        live_model,
        voice_name,
        language_code: reply.language_code,
        transcription_model: reply.transcription_model,
        generation_model: reply.generation_model,
        fast_path: Boolean(reply.fast_path),
        timings: reply.timings || null,
        total_request_ms: Date.now() - startedAt,
        audio_generation_model: reply.audio_generation_model,
        audio_ready: Boolean(reply.reply_audio_base64),
        audio_error: reply.audio_error,
        live_fallback_reason: reply.live_fallback_reason,
        user_text_preview: reply.user_text.slice(0, 160),
        reply_preview: reply.reply_text.slice(0, 160),
      },
    });

    return res.json({
      success: true,
      reply,
    });
  } catch (err) {
    voiceLogger.errorWithContext('runAgentTestAudioTurn failed', err, {
      requestId: req.requestId,
      agentId,
      audioMimeType: req.file?.mimetype || null,
      audioBytes: req.file?.size || req.file?.buffer?.length || 0,
    });

    await dataflow.logAgentBuilderEvent({
      event_type: 'agent_test_audio_turn_failed',
      stage: 'test_audio_reply',
      message: 'Browser microphone audio test turn failed',
      agent_id: agentId,
      payload: {
        request_id: req.requestId,
        error: err.message,
        error_code: err.code || null,
        transcription_model: err.transcription?.model || null,
        audio_mime_type: req.file?.mimetype || null,
        audio_bytes: req.file?.size || req.file?.buffer?.length || 0,
      },
    });

    return res.status(err.code === 'EMPTY_TRANSCRIPT' ? 422 : 502).json({
      success: false,
      error: { message: err.message || 'Agent test audio turn failed.' },
    });
  }
};

const runAudioTurnStream = async (req, res) => {
  const { agentId } = req.params;
  const startedAt = Date.now();
  let sseStarted = false;

  try {
    const agent = await agentRepo.getById(agentId);
    if (!agent) {
      return res.status(404).json({ success: false, error: { message: 'Agent not found' } });
    }
    if (!req.file?.buffer?.length) {
      return res.status(400).json({
        success: false,
        error: { message: 'audio file is required for the agent test audio stream.' },
      });
    }

    const {
      live_model,
      voice_name,
      audio_prompt,
      language_code,
    } = req.body || {};
    const builderSettings = parseJsonField(req.body?.builder_settings, {});
    const history = parseJsonField(req.body?.history, []);
    const audioMimeType = req.file.mimetype || req.body?.audio_mime_type || 'audio/webm';

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    sseStarted = true;

    writeSse(res, 'received', {
      request_id: req.requestId,
      agent_id: agentId,
      live_model,
      voice_name,
      language_code,
      audio_mime_type: audioMimeType,
      audio_bytes: req.file.size || req.file.buffer.length,
      history_count: Array.isArray(history) ? history.length : 0,
    });

    await dataflow.logAgentBuilderEvent({
      event_type: 'agent_test_audio_stream_received',
      stage: 'test_audio_stream',
      message: 'Streaming browser microphone audio test received',
      agent_id: agentId,
      payload: {
        request_id: req.requestId,
        live_model,
        voice_name,
        language_code,
        audio_mime_type: audioMimeType,
        audio_bytes: req.file.size || req.file.buffer.length,
      },
    });

    const reply = await agentTest.generateAgentReplyFromAudio({
      liveModel: live_model,
      voiceName: voice_name,
      audioPrompt: audio_prompt,
      builderSettings,
      languageCode: language_code,
      history,
      audioBuffer: req.file.buffer,
      audioMimeType,
    });

    writeSse(res, 'reply', {
      request_id: req.requestId,
      reply: {
        ...reply,
        reply_audio_base64: null,
      },
    });

    let audioSummary = null;
    try {
      audioSummary = await agentTest.streamAgentSpeechAudio({
        voiceName: voice_name,
        prompt: reply.reply_text,
        selectedModel: live_model,
        languageCode: reply.language_code,
        languageLabel: reply.language_label,
        onChunk: async (chunk) => {
          writeSse(res, 'audio_chunk', {
            request_id: req.requestId,
            ...chunk,
          });
        },
      });
      writeSse(res, 'audio_done', {
        request_id: req.requestId,
        audio: audioSummary,
      });
    } catch (audioErr) {
      audioSummary = { error: audioErr.message };
      writeSse(res, 'audio_error', {
        request_id: req.requestId,
        error: audioErr.message,
      });
    }

    await dataflow.logAgentBuilderEvent({
      event_type: 'agent_test_audio_stream_completed',
      stage: 'test_audio_stream',
      message: 'Streaming browser microphone audio test completed',
      agent_id: agentId,
      payload: {
        request_id: req.requestId,
        live_model,
        voice_name,
        language_code: reply.language_code,
        fast_path: Boolean(reply.fast_path),
        transcription_model: reply.transcription_model,
        generation_model: reply.generation_model,
        audio_stream: audioSummary,
        timings: reply.timings || null,
        total_request_ms: Date.now() - startedAt,
        user_text_preview: reply.user_text.slice(0, 160),
        reply_preview: reply.reply_text.slice(0, 160),
      },
    });

    writeSse(res, 'done', {
      request_id: req.requestId,
      total_request_ms: Date.now() - startedAt,
    });
    return res.end();
  } catch (err) {
    voiceLogger.errorWithContext('runAgentTestAudioTurnStream failed', err, {
      requestId: req.requestId,
      agentId,
      sseStarted,
      audioMimeType: req.file?.mimetype || null,
      audioBytes: req.file?.size || req.file?.buffer?.length || 0,
    });

    await dataflow.logAgentBuilderEvent({
      event_type: 'agent_test_audio_stream_failed',
      stage: 'test_audio_stream',
      message: 'Streaming browser microphone audio test failed',
      agent_id: agentId,
      payload: {
        request_id: req.requestId,
        error: err.message,
        error_code: err.code || null,
        audio_mime_type: req.file?.mimetype || null,
        audio_bytes: req.file?.size || req.file?.buffer?.length || 0,
      },
    });

    if (sseStarted) {
      writeSse(res, 'error', {
        request_id: req.requestId,
        message: err.message || 'Agent test audio stream failed.',
      });
      return res.end();
    }

    return res.status(err.code === 'EMPTY_TRANSCRIPT' ? 422 : 502).json({
      success: false,
      error: { message: err.message || 'Agent test audio stream failed.' },
    });
  }
};

module.exports = {
  runTurn,
  runAudioTurn,
  runAudioTurnStream,
};
