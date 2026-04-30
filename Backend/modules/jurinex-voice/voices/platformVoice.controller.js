/**
 * HTTP controllers for platform voice catalog and previews.
 */
const crypto = require('crypto');

const repo = require('./platformVoice.repository');
const previewService = require('./platformVoicePreview.service');
const {
  buildVoicePreviewAudioObjectName,
  getPublicUrl,
  getSignedReadUrl,
  uploadFileToGcs,
} = require('../gcs/gcsStorage.service');
const dataflow = require('../observability/dataflowLogger');
const voiceLogger = require('../observability/voiceLogger');

const LANGUAGE_LABELS = {
  en: 'English',
  'en-US': 'English (US)',
  'en-IN': 'English (India)',
  'en-GB': 'English (UK)',
  'en-AU': 'English (Australia)',
  hi: 'Hindi',
  'hi-IN': 'Hindi (India)',
  mr: 'Marathi',
  'mr-IN': 'Marathi (India)',
  multi: 'Multilingual',
};

const normalizeLanguageCode = (raw, available = []) => {
  const value = String(raw || '').trim();
  if (!value || value === 'multi') {
    return available[0] || 'en-US';
  }
  if (value === 'en') return available.find((item) => item.startsWith('en-')) || 'en-US';
  if (value === 'hi') return available.includes('hi-IN') ? 'hi-IN' : 'hi-IN';
  if (value === 'mr') return available.includes('mr-IN') ? 'mr-IN' : 'mr-IN';
  return value;
};

const renderPrompt = (template, values) =>
  String(template || '').replace(/\{\{([a-z_]+)\}\}/g, (_, key) => values[key] || '');

const sha256Text = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

const getPlaybackUrl = async (audioRow) => {
  try {
    return await getSignedReadUrl(audioRow.gcs_bucket, audioRow.gcs_object_name, 60);
  } catch (err) {
    voiceLogger.warn('previewAudioSignedUrl failed, falling back to public URL', {
      summary: {
        audioId: audioRow.id,
        bucket: audioRow.gcs_bucket,
        objectName: audioRow.gcs_object_name,
        error: err.message,
      },
    });
    return audioRow.public_url || getPublicUrl(audioRow.gcs_bucket, audioRow.gcs_object_name);
  }
};

const toPreviewAudioPayload = async ({
  audioRow,
  prompt,
  resolvedLanguage,
  languageLabel,
  liveModel,
  voice,
  cacheHit,
  generatedAudio = null,
}) => ({
  text: prompt,
  language_code: resolvedLanguage,
  language_label: languageLabel,
  live_model: liveModel,
  duration_seconds: audioRow.duration_seconds || voice.preview_duration_seconds,
  config: voice.config,
  generation_source: generatedAudio?.generationSource || audioRow.generation_source,
  generation_model: generatedAudio?.generationModel || audioRow.tts_model,
  live_fallback_reason: generatedAudio?.liveFallbackReason || null,
  cache_hit: cacheHit,
  mime_type: audioRow.audio_mime_type,
  audio_bytes: audioRow.audio_bytes,
  audio_db_id: audioRow.id,
  audio_gcs_uri: audioRow.gcs_uri,
  audio_url: await getPlaybackUrl(audioRow),
});

const list = async (req, res) => {
  try {
    const voices = await repo.list({
      gender: req.query.gender || null,
      accent: req.query.accent || null,
      search: req.query.search || null,
    });
    return res.json({ success: true, voices });
  } catch (err) {
    voiceLogger.errorWithContext('listPlatformVoices failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

const preview = async (req, res) => {
  try {
    const voice = await repo.getByKeyOrName(req.params.voiceKey);
    if (!voice) {
      return res.status(404).json({ success: false, error: { message: 'Platform voice not found' } });
    }

    const {
      live_model,
      language_code,
      selected_languages = [],
      agent_id = null,
    } = req.body || {};
    const languageFromSelection =
      Array.isArray(selected_languages)
        ? selected_languages.find((item) => item && item !== 'multi')
        : null;
    const resolvedLanguage = normalizeLanguageCode(
      language_code || languageFromSelection,
      voice.language_codes
    );
    const liveModel = live_model || voice.live_model;
    const languageLabel = LANGUAGE_LABELS[resolvedLanguage] || resolvedLanguage;
    const prompt = renderPrompt(voice.preview_prompt, {
      voice_name: voice.name,
      style: String(voice.style || '').toLowerCase(),
      accent: voice.accent,
      live_model: liveModel,
      language_label: languageLabel,
    });
    const promptHash = sha256Text(prompt);
    const ttsModel = previewService.getPreviewTtsModel(liveModel);

    await dataflow.logAgentBuilderEvent({
      event_type: 'platform_voice_preview_requested',
      stage: 'voice_preview',
      message: 'Platform voice preview requested',
      agent_id,
      payload: {
        request_id: req.requestId,
        voice_key: voice.voice_key,
        voice_name: voice.name,
        live_model: liveModel,
        tts_model: ttsModel,
        language_code: resolvedLanguage,
        preview_duration_seconds: voice.preview_duration_seconds,
      },
    });

    let audio = null;
    let audioRow = await repo.findPreviewAudio({
      voice_key: voice.voice_key,
      language_code: resolvedLanguage,
      live_model: liveModel,
      tts_model: ttsModel,
      prompt_hash: promptHash,
    });

    if (audioRow) {
      await dataflow.logAgentBuilderEvent({
        event_type: 'platform_voice_preview_recording_reused',
        stage: 'voice_preview',
        message: 'Platform voice preview recording reused from GCS',
        agent_id,
        payload: {
          request_id: req.requestId,
          voice_key: voice.voice_key,
          voice_name: voice.name,
          live_model: liveModel,
          tts_model: ttsModel,
          language_code: resolvedLanguage,
          audio_db_id: audioRow.id,
          gcs_uri: audioRow.gcs_uri,
          audio_bytes: audioRow.audio_bytes,
        },
      });

      return res.json({
        success: true,
        voice,
        preview: await toPreviewAudioPayload({
          audioRow,
          prompt,
          resolvedLanguage,
          languageLabel,
          liveModel,
          voice,
          cacheHit: true,
        }),
      });
    }

    try {
      audio = await previewService.generatePreviewAudio({
        voice,
        prompt,
        liveModel,
        languageCode: resolvedLanguage,
        languageLabel,
        durationSeconds: voice.preview_duration_seconds,
      });

      const audioBuffer =
        audio.audioBuffer ||
        (audio.audioBase64 ? Buffer.from(audio.audioBase64, 'base64') : null);

      if (!audioBuffer?.length) {
        throw new Error('Preview audio generation returned an empty WAV buffer.');
      }

      const objectName = buildVoicePreviewAudioObjectName({
        voiceKey: voice.voice_key,
        languageCode: resolvedLanguage,
        liveModel,
        ttsModel,
        promptHash,
      });
      const gcs = await uploadFileToGcs(audioBuffer, objectName, audio.mimeType || 'audio/wav');
      const publicUrl = getPublicUrl(gcs.bucket, gcs.objectName);

      audioRow = await repo.insertPreviewAudio({
        voice_id: voice.id,
        voice_key: voice.voice_key,
        language_code: resolvedLanguage,
        live_model: liveModel,
        tts_model: ttsModel,
        prompt_hash: promptHash,
        prompt_text: prompt,
        generation_source: audio.generationSource,
        duration_seconds: voice.preview_duration_seconds,
        audio_mime_type: audio.mimeType || 'audio/wav',
        audio_bytes: audio.byteLength || audioBuffer.length,
        gcs_bucket: gcs.bucket,
        gcs_object_name: gcs.objectName,
        gcs_uri: gcs.gcsUri,
        public_url: publicUrl,
      });

      await dataflow.logAgentBuilderEvent({
        event_type: 'platform_voice_preview_audio_ready',
        stage: 'voice_preview',
        message: 'Platform voice preview audio generated',
        agent_id,
        payload: {
          request_id: req.requestId,
          voice_key: voice.voice_key,
          voice_name: voice.name,
          live_model: liveModel,
          tts_model: ttsModel,
          generation_source: audio.generationSource,
          generation_model: audio.generationModel,
          live_fallback_reason: audio.liveFallbackReason || null,
          cache_hit: Boolean(audio.cacheHit),
          language_code: resolvedLanguage,
          mime_type: audio.mimeType,
          audio_bytes: audioRow.audio_bytes,
          audio_db_id: audioRow.id,
          gcs_uri: audioRow.gcs_uri,
          gcs_object_name: audioRow.gcs_object_name,
        },
      });
    } catch (err) {
      voiceLogger.errorWithContext('generatePlatformVoicePreviewAudio failed', err, {
        requestId: req.requestId,
        voiceKey: voice.voice_key,
        liveModel,
      });

      await dataflow.logAgentBuilderEvent({
        event_type: 'platform_voice_preview_audio_failed',
        stage: 'voice_preview',
        message: 'Platform voice preview audio generation failed',
        agent_id,
        payload: {
          request_id: req.requestId,
          voice_key: voice.voice_key,
          voice_name: voice.name,
          live_model: liveModel,
          language_code: resolvedLanguage,
          error: err.message,
        },
      });

      return res.status(502).json({
        success: false,
        error: {
          message: err.message || 'Could not generate platform voice preview audio.',
        },
      });
    }

    return res.json({
      success: true,
      voice,
      preview: await toPreviewAudioPayload({
        audioRow,
        prompt,
        resolvedLanguage,
        languageLabel,
        liveModel,
        voice,
        cacheHit: Boolean(audio.cacheHit),
        generatedAudio: audio,
      }),
    });
  } catch (err) {
    voiceLogger.errorWithContext('previewPlatformVoice failed', err, { requestId: req.requestId });
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

module.exports = {
  list,
  preview,
};
