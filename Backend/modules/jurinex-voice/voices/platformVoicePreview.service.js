/**
 * Builds playable audio previews for platform voices.
 *
 * The real agent can use Gemini Live directly. For a one-click preview, this
 * service uses the fast one-shot audio path by default so the UI is responsive.
 * Live-first preview can still be enabled with JURINEX_VOICE_PREVIEW_DIRECT_LIVE=true.
 */
const { GoogleGenAI, Modality } = require('@google/genai');

const DEFAULT_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const DEFAULT_LIVE_TIMEOUT_MS = 2500;
const DEFAULT_SAMPLE_RATE = 24000;
const DEFAULT_CHANNELS = 1;
const DEFAULT_BITS_PER_SAMPLE = 16;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 80;

const previewCache = new Map();
const pendingPreviewCache = new Map();

const isTtsModel = (model) => String(model || '').toLowerCase().includes('tts');

const getPreviewTtsModel = (selectedModel) => {
  if (isTtsModel(selectedModel)) return selectedModel;
  return process.env.JURINEX_VOICE_PREVIEW_TTS_MODEL || DEFAULT_TTS_MODEL;
};

const getApiKey = () =>
  process.env.JURINEX_VOICE_PREVIEW_GOOGLE_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY ||
  '';

const isLiveModel = (model) => String(model || '').toLowerCase().includes('live');

const getInlineAudioParts = (parts = []) =>
  parts
    .map((part) => part?.inlineData)
    .filter((inlineData) => inlineData?.data)
    .map((inlineData) => ({
      data: inlineData.data,
      mimeType: inlineData.mimeType || inlineData.mime_type || 'audio/wav',
    }));

const isWavMime = (mimeType = '') => /audio\/(x-)?wav|audio\/wave/i.test(mimeType);

const parseSampleRate = (mimeType = '') => {
  const match = String(mimeType).match(/rate=(\d+)/i);
  return match ? Number(match[1]) : DEFAULT_SAMPLE_RATE;
};

const writeString = (buffer, offset, value) => buffer.write(value, offset, 'ascii');

const pcmToWav = (pcmBuffer, sampleRate = DEFAULT_SAMPLE_RATE) => {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * DEFAULT_CHANNELS * (DEFAULT_BITS_PER_SAMPLE / 8);
  const blockAlign = DEFAULT_CHANNELS * (DEFAULT_BITS_PER_SAMPLE / 8);

  writeString(header, 0, 'RIFF');
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  writeString(header, 8, 'WAVE');
  writeString(header, 12, 'fmt ');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(DEFAULT_CHANNELS, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(DEFAULT_BITS_PER_SAMPLE, 34);
  writeString(header, 36, 'data');
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
};

const combineAudioParts = (parts) => {
  if (!parts.length) {
    throw new Error('Gemini returned no audio chunks for this preview.');
  }

  const firstMime = parts[0].mimeType || 'audio/wav';
  const buffers = parts.map((part) => Buffer.from(part.data, 'base64'));

  if (parts.length === 1 && isWavMime(firstMime)) {
    return {
      audioBuffer: buffers[0],
      audioBase64: buffers[0].toString('base64'),
      mimeType: firstMime,
      byteLength: buffers[0].length,
    };
  }

  const joined = Buffer.concat(buffers);
  if (isWavMime(firstMime)) {
    return {
      audioBuffer: joined,
      audioBase64: joined.toString('base64'),
      mimeType: firstMime,
      byteLength: joined.length,
    };
  }

  const wav = pcmToWav(joined, parseSampleRate(firstMime));
  return {
    audioBuffer: wav,
    audioBase64: wav.toString('base64'),
    mimeType: 'audio/wav',
    byteLength: wav.length,
  };
};

const buildSpeechConfig = (voiceName, languageCode) => ({
  languageCode,
  voiceConfig: {
    prebuiltVoiceConfig: {
      voiceName,
    },
  },
});

const buildPrompt = ({ prompt, durationSeconds, languageLabel }) =>
  `Return audio only. Speak this naturally in ${languageLabel || 'the selected language'} for about ${
    durationSeconds || 12
  } seconds: ${prompt}`;

const createClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error(
      'JURINEX_VOICE_PREVIEW_GOOGLE_API_KEY, GOOGLE_API_KEY, or GEMINI_API_KEY is required for platform voice previews.'
    );
    err.code = 'MISSING_GEMINI_API_KEY';
    throw err;
  }
  return new GoogleGenAI({ apiKey });
};

const generateWithTts = async ({
  ai,
  voice,
  prompt,
  selectedModel,
  languageCode,
  languageLabel,
  durationSeconds,
}) => {
  const ttsModel = getPreviewTtsModel(selectedModel);
  const response = await ai.models.generateContent({
    model: ttsModel,
    contents: [
      {
        role: 'user',
        parts: [{ text: buildPrompt({ prompt, durationSeconds, languageLabel }) }],
      },
    ],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: buildSpeechConfig(voice.name, languageCode),
    },
  });

  const parts = getInlineAudioParts(response?.candidates?.[0]?.content?.parts);
  const audio = combineAudioParts(parts);
  return {
    ...audio,
    generationSource: 'gemini_tts',
    generationModel: ttsModel,
  };
};

const pruneCache = () => {
  const now = Date.now();
  for (const [key, value] of previewCache.entries()) {
    if (!value?.expiresAt || value.expiresAt <= now) {
      previewCache.delete(key);
    }
  }
  while (previewCache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = previewCache.keys().next().value;
    previewCache.delete(oldestKey);
  }
};

const getCacheKey = ({ voice, prompt, liveModel, languageCode, durationSeconds }) => {
  const ttsModel = getPreviewTtsModel(liveModel);
  const directLive = String(process.env.JURINEX_VOICE_PREVIEW_DIRECT_LIVE || 'false') === 'true';
  return [
    voice.voice_key || voice.name,
    languageCode,
    liveModel,
    ttsModel,
    durationSeconds || 12,
    directLive ? 'live-first' : 'tts-fast',
    Buffer.from(prompt || '').toString('base64'),
  ].join('|');
};

const generateWithLive = ({ ai, voice, prompt, liveModel, languageCode, languageLabel, durationSeconds }) =>
  new Promise((resolve, reject) => {
    const audioParts = [];
    let session = null;
    let settled = false;

    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        session?.close?.();
      } catch {
        /* ignore close errors */
      }
      if (err) {
        reject(err);
        return;
      }
      try {
        const audio = combineAudioParts(audioParts);
        resolve({
          ...audio,
          generationSource: 'gemini_live',
          generationModel: liveModel,
        });
      } catch (combineErr) {
        reject(combineErr);
      }
    };

    const timeoutMs = Number(process.env.JURINEX_VOICE_PREVIEW_LIVE_TIMEOUT_MS || DEFAULT_LIVE_TIMEOUT_MS);
    const timer = setTimeout(() => {
      if (audioParts.length) {
        finish();
        return;
      }
      finish(new Error(`Live preview timed out after ${timeoutMs}ms without audio.`));
    }, timeoutMs);

    ai.live
      .connect({
        model: liveModel,
        callbacks: {
          onmessage: (message) => {
            const parts = message?.serverContent?.modelTurn?.parts || [];
            audioParts.push(...getInlineAudioParts(parts));

            if (message?.serverContent?.generationComplete || message?.serverContent?.turnComplete) {
              finish();
            }
          },
          onerror: (event) => {
            const error = event?.error || event;
            finish(error instanceof Error ? error : new Error(String(error || 'Live preview failed.')));
          },
          onclose: () => {
            if (!settled && audioParts.length) finish();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: buildSpeechConfig(voice.name, languageCode),
          systemInstruction: [
            `You are generating a short voice preview for ${voice.name}.`,
            `Speak in ${languageLabel || languageCode}.`,
            'Return audio only.',
          ].join(' '),
        },
      })
      .then((connectedSession) => {
        session = connectedSession;
        session.sendClientContent({
          turns: [
            {
              role: 'user',
              parts: [{ text: buildPrompt({ prompt, durationSeconds, languageLabel }) }],
            },
          ],
          turnComplete: true,
        });
      })
      .catch((err) => finish(err));
  });

const generatePreviewAudio = async ({
  voice,
  prompt,
  liveModel,
  languageCode,
  languageLabel,
  durationSeconds,
}) => {
  pruneCache();

  const cacheKey = getCacheKey({ voice, prompt, liveModel, languageCode, durationSeconds });
  const cached = previewCache.get(cacheKey);
  if (cached?.expiresAt > Date.now()) {
    return {
      ...cached.audio,
      cacheHit: true,
    };
  }

  const pending = pendingPreviewCache.get(cacheKey);
  if (pending) {
    const audio = await pending;
    return {
      ...audio,
      cacheHit: true,
    };
  }

  const canTryLive =
    isLiveModel(liveModel) && String(process.env.JURINEX_VOICE_PREVIEW_DIRECT_LIVE || 'false') === 'true';

  const generate = async () => {
    const ai = createClient();

    if (!canTryLive) {
      return generateWithTts({
        ai,
        voice,
        prompt,
        selectedModel: liveModel,
        languageCode,
        languageLabel,
        durationSeconds,
      });
    }

    try {
      return await generateWithLive({
        ai,
        voice,
        prompt,
        liveModel,
        languageCode,
        languageLabel,
        durationSeconds,
      });
    } catch (err) {
      const tts = await generateWithTts({
        ai,
        voice,
        prompt,
        selectedModel: liveModel,
        languageCode,
        languageLabel,
        durationSeconds,
      });
      return {
        ...tts,
        liveFallbackReason: err.message,
      };
    }
  };

  const generation = generate()
    .then((audio) => {
      previewCache.set(cacheKey, {
        audio,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
      pruneCache();
      return audio;
    })
    .finally(() => {
      pendingPreviewCache.delete(cacheKey);
    });

  pendingPreviewCache.set(cacheKey, generation);
  return generation;
};

const generateSpeechAudio = async ({
  voiceName,
  prompt,
  selectedModel,
  languageCode,
  languageLabel,
  durationSeconds,
}) => {
  const ai = createClient();
  return generateWithTts({
    ai,
    voice: { name: voiceName },
    prompt,
    selectedModel,
    languageCode,
    languageLabel,
    durationSeconds,
  });
};

module.exports = {
  getPreviewTtsModel,
  generateSpeechAudio,
  generatePreviewAudio,
};
