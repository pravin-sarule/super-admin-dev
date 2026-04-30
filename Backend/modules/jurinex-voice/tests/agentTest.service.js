/**
 * Turn-by-turn browser test conversation for the agent builder.
 *
 * The browser owns microphone capture and speech recognition. The backend
 * owns model calls and optional Gemini TTS audio so API keys never reach the UI.
 */
const { GoogleGenAI, Modality } = require('@google/genai');

const previewAudio = require('../voices/platformVoicePreview.service');

const DEFAULT_LIVE_MODEL = 'gemini-2.5-flash-native-audio-latest';
const DEFAULT_TEXT_FALLBACK_MODEL = 'gemini-2.5-flash';
const DEFAULT_TRANSCRIBE_MODEL = 'gemini-2.5-flash';
const DEFAULT_FAST_AUDIO_MODEL = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_MS = 18000;
const DEFAULT_TTS_TIMEOUT_MS = 8000;

const LANGUAGE_LABELS = {
  en: 'English',
  'en-US': 'English (US)',
  'en-IN': 'English (India)',
  hi: 'Hindi',
  'hi-IN': 'Hindi (India)',
  mr: 'Marathi',
  'mr-IN': 'Marathi (India)',
  multi: 'Multilingual',
};

// Gemini Live (bidiGenerateContent) only accepts long-lived AI Studio keys
// that start with "AIza...". Ephemeral OAuth tokens ("AQ.Ab8...") fail with
// WS close 1008 "Operation is not implemented, or supported, or enabled."
// Prefer GOOGLE_API_KEY/GEMINI_API_KEY first; the preview key is reserved
// for the TTS preview flow and only used as a last resort.
const getApiKey = () =>
  process.env.JURINEX_VOICE_TEST_GOOGLE_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.JURINEX_VOICE_PREVIEW_GOOGLE_API_KEY ||
  '';

const createClient = (options = {}) => {
  const apiKey = getApiKey();
  if (!apiKey) {
    const err = new Error(
      'JURINEX_VOICE_TEST_GOOGLE_API_KEY, JURINEX_VOICE_PREVIEW_GOOGLE_API_KEY, GOOGLE_API_KEY, or GEMINI_API_KEY is required for agent test conversation.'
    );
    err.code = 'MISSING_GEMINI_API_KEY';
    throw err;
  }
  return new GoogleGenAI({ apiKey, ...options });
};

const isLiveModel = (model) => String(model || '').toLowerCase().includes('live');

const resolveConversationModel = (selectedModel) =>
  isLiveModel(selectedModel)
    ? selectedModel
    : process.env.JURINEX_VOICE_TEST_LIVE_MODEL || DEFAULT_LIVE_MODEL;

const normalizeLanguageCode = (raw, selectedLanguages = []) => {
  const selected = Array.isArray(selectedLanguages)
    ? selectedLanguages.find((item) => item && item !== 'multi')
    : null;
  const value = String(raw || selected || 'en-US').trim();
  if (value === 'en') return 'en-US';
  if (value === 'hi') return 'hi-IN';
  if (value === 'mr') return 'mr-IN';
  if (value === 'multi') return 'en-US';
  return value || 'en-US';
};

const normalizeAudioMimeType = (mimeType) =>
  String(mimeType || 'audio/webm').split(';')[0].trim() || 'audio/webm';

const getInlineAudioParts = (parts = []) =>
  parts
    .map((part) => part?.inlineData)
    .filter((inlineData) => inlineData?.data)
    .map((inlineData) => ({
      data: inlineData.data,
      mimeType: inlineData.mimeType || inlineData.mime_type || 'audio/L16;rate=24000',
    }));

const textFromGenerateContent = (response) => {
  if (typeof response?.text === 'string') return response.text.trim();
  return (response?.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || '')
    .join('')
    .trim();
};

const parseJsonObject = (value) => {
  const text = String(value || '')
    .trim()
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      const transcript = text.match(/"?transcript"?\s*:\s*"([^"]*)/i)?.[1];
      const reply = text.match(/"?reply_text"?\s*:\s*"([\s\S]*)/i)?.[1];
      return transcript || reply
        ? {
            transcript: transcript || '',
            reply_text: String(reply || '').replace(/["'`}]+$/g, '').trim(),
          }
        : null;
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      const partial = match[0];
      const transcript = partial.match(/"transcript"\s*:\s*"([^"]*)/i)?.[1];
      const reply = partial.match(/"reply_text"\s*:\s*"([\s\S]*)/i)?.[1];
      return transcript || reply
        ? {
            transcript: transcript || '',
            reply_text: String(reply || '').replace(/["'`}\]]+$/g, '').trim(),
          }
        : null;
    }
  }
};

const transcribeUserAudio = async ({ audioBuffer, mimeType, languageCode, selectedLanguages }) => {
  if (!audioBuffer?.length) {
    throw new Error('No microphone audio was received for transcription.');
  }

  const resolvedLanguage = normalizeLanguageCode(languageCode, selectedLanguages);
  const languageLabel = LANGUAGE_LABELS[resolvedLanguage] || resolvedLanguage;
  const ai = createClient();
  const model = process.env.JURINEX_VOICE_TEST_TRANSCRIBE_MODEL || DEFAULT_TRANSCRIBE_MODEL;
  const cleanMimeType = normalizeAudioMimeType(mimeType);

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: [
              `Transcribe this user microphone audio in ${languageLabel}.`,
              'Return only the exact transcript text.',
              'If there is no speech, return an empty string.',
            ].join(' '),
          },
          {
            inlineData: {
              mimeType: cleanMimeType,
              data: audioBuffer.toString('base64'),
            },
          },
        ],
      },
    ],
  });

  return {
    transcript: textFromGenerateContent(response).replace(/^["']|["']$/g, '').trim(),
    model,
    language_code: resolvedLanguage,
    language_label: languageLabel,
  };
};

const buildSystemInstruction = ({ audioPrompt, languageLabel }) =>
  [
    String(audioPrompt || '').trim(),
    '',
    `You are running a live browser audio test. Reply in ${languageLabel}.`,
    'Respond naturally and completely according to the caller request.',
    'Ask one focused follow-up question when you need more information.',
    'Do not mention that this is a test unless the user asks.',
  ]
    .filter(Boolean)
    .join('\n');

const buildTurnPrompt = ({ history = [], userText }) => {
  const recent = history
    .slice(-8)
    .map((message) => {
      const role = message.role === 'assistant' ? 'Agent' : 'User';
      return `${role}: ${String(message.text || message.content || '').trim()}`;
    })
    .filter((line) => !line.endsWith(':'))
    .join('\n');

  return [
    recent ? `Recent conversation:\n${recent}` : '',
    `User just said: ${userText}`,
    'Respond as the configured voice agent.',
  ]
    .filter(Boolean)
    .join('\n\n');
};

const buildFastAudioTurnPrompt = ({ audioPrompt, history = [], languageLabel }) => {
  const recent = history
    .slice(-8)
    .map((message) => {
      const role = message.role === 'assistant' ? 'Agent' : 'User';
      return `${role}: ${String(message.text || message.content || '').trim()}`;
    })
    .filter((line) => !line.endsWith(':'))
    .join('\n');

  return [
    'You are running a low-latency browser voice-agent test.',
    `Target response language: ${languageLabel}.`,
    'Agent instructions:',
    String(audioPrompt || '').trim(),
    recent ? `Recent conversation:\n${recent}` : '',
    'Task:',
    '1. Transcribe the attached user microphone audio.',
    '2. Respond as the configured voice agent.',
    '3. Respond naturally and completely according to the caller request.',
    '4. Return ONLY valid JSON with this exact shape:',
    '{"transcript":"exact user speech","reply_text":"agent response"}',
  ]
    .filter(Boolean)
    .join('\n\n');
};

const generateFastAudioReply = async ({
  audioBuffer,
  audioMimeType,
  audioPrompt,
  history,
  languageCode,
  selectedLanguages,
}) => {
  if (!audioBuffer?.length) {
    throw new Error('No microphone audio was received for the fast test turn.');
  }

  const startedAt = Date.now();
  const resolvedLanguage = normalizeLanguageCode(languageCode, selectedLanguages);
  const languageLabel = LANGUAGE_LABELS[resolvedLanguage] || resolvedLanguage;
  const cleanMimeType = normalizeAudioMimeType(audioMimeType);
  const ai = createClient();
  const model = process.env.JURINEX_VOICE_TEST_FAST_MODEL || DEFAULT_FAST_AUDIO_MODEL;

  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: buildFastAudioTurnPrompt({ audioPrompt, history, languageLabel }),
          },
          {
            inlineData: {
              mimeType: cleanMimeType,
              data: audioBuffer.toString('base64'),
            },
          },
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'object',
        properties: {
          transcript: { type: 'string' },
          reply_text: { type: 'string' },
        },
        required: ['transcript', 'reply_text'],
      },
    },
  });

  const rawText = textFromGenerateContent(response);
  const parsed = parseJsonObject(rawText);
  const transcript = String(parsed?.transcript || '').trim();
  const replyText = String(parsed?.reply_text || parsed?.reply || '').trim();
  if (!transcript || !replyText) {
    const err = new Error('Fast audio reply did not return transcript and reply_text.');
    err.rawResponse = rawText;
    throw err;
  }

  return {
    user_text: transcript,
    reply_text: replyText,
    language_code: resolvedLanguage,
    language_label: languageLabel,
    transcription_model: model,
    generation_model: model,
    fast_path: true,
    timings: {
      fast_audio_reply_ms: Date.now() - startedAt,
    },
  };
};

const generateWithLiveText = ({ ai, model, systemInstruction, prompt }) =>
  new Promise((resolve, reject) => {
    const textParts = [];
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
      const text = textParts.join('').trim();
      if (!text) {
        reject(new Error('Gemini Live returned no text for the test turn.'));
        return;
      }
      resolve(text);
    };

    const timeoutMs = Number(process.env.JURINEX_VOICE_TEST_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
    const timer = setTimeout(
      () => finish(new Error(`Agent test turn timed out after ${timeoutMs}ms.`)),
      timeoutMs
    );

    ai.live
      .connect({
        model,
        callbacks: {
          onmessage: (message) => {
            const parts = message?.serverContent?.modelTurn?.parts || [];
            parts.forEach((part) => {
              if (part?.text) textParts.push(part.text);
            });

            if (message?.serverContent?.generationComplete || message?.serverContent?.turnComplete) {
              finish();
            }
          },
          onerror: (event) => {
            const error = event?.error || event;
            finish(error instanceof Error ? error : new Error(String(error || 'Gemini Live test failed.')));
          },
          onclose: () => {
            if (!settled && textParts.length) finish();
          },
        },
        config: {
          responseModalities: [Modality.TEXT],
          systemInstruction,
        },
      })
      .then((connectedSession) => {
        session = connectedSession;
        session.sendClientContent({
          turns: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          turnComplete: true,
        });
      })
      .catch((err) => finish(err));
  });

const generateWithTextFallback = async ({ ai, systemInstruction, prompt }) => {
  const model = process.env.JURINEX_VOICE_TEST_TEXT_FALLBACK_MODEL || DEFAULT_TEXT_FALLBACK_MODEL;
  const response = await ai.models.generateContent({
    model,
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemInstruction}\n\n${prompt}` }],
      },
    ],
  });
  const text = textFromGenerateContent(response);
  if (!text) throw new Error('Gemini returned an empty agent test response.');
  return { text, model };
};

const withAudioTimeout = async (audioPromise) => {
  const timeoutMs = Number(process.env.JURINEX_VOICE_TEST_TTS_TIMEOUT_MS || DEFAULT_TTS_TIMEOUT_MS);
  return Promise.race([
    audioPromise
      .then((audio) => ({ audio }))
      .catch((err) => ({ audioError: err.message })),
    new Promise((resolve) =>
      setTimeout(
        () => resolve({ audioError: `Agent speech generation timed out after ${timeoutMs}ms.` }),
        timeoutMs
      )
    ),
  ]);
};

const streamAgentSpeechAudio = async ({
  voiceName,
  prompt,
  selectedModel,
  languageCode,
  languageLabel,
  onChunk,
}) => {
  const startedAt = Date.now();
  const ai = createClient();
  const ttsModel = previewAudio.getPreviewTtsModel(selectedModel);
  let chunks = 0;
  let audioBytes = 0;
  let firstChunkMs = null;
  let mimeType = null;

  const stream = await ai.models.generateContentStream({
    model: ttsModel,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `Return audio only. Speak naturally in ${languageLabel || languageCode}: ${prompt}`,
          },
        ],
      },
    ],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        languageCode,
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceName || 'Puck',
          },
        },
      },
    },
  });

  for await (const chunk of stream) {
    const audioParts = getInlineAudioParts(chunk?.candidates?.[0]?.content?.parts);
    for (const part of audioParts) {
      chunks += 1;
      const byteLength = Buffer.from(part.data, 'base64').length;
      audioBytes += byteLength;
      mimeType = part.mimeType || mimeType;
      if (firstChunkMs == null) firstChunkMs = Date.now() - startedAt;
      await onChunk?.({
        index: chunks,
        data: part.data,
        mime_type: part.mimeType,
        byte_length: byteLength,
        generation_model: ttsModel,
      });
    }
  }

  return {
    generation_model: ttsModel,
    chunks,
    audio_bytes: audioBytes,
    mime_type: mimeType,
    first_chunk_ms: firstChunkMs,
    total_ms: Date.now() - startedAt,
  };
};

const generateAgentReply = async ({
  liveModel,
  voiceName,
  audioPrompt,
  builderSettings,
  languageCode,
  history,
  userText,
}) => {
  const selectedLanguages = builderSettings?.languages || [];
  const resolvedLanguage = normalizeLanguageCode(languageCode, selectedLanguages);
  const languageLabel = LANGUAGE_LABELS[resolvedLanguage] || resolvedLanguage;
  const conversationModel = resolveConversationModel(liveModel);
  const ai = createClient();
  const systemInstruction = buildSystemInstruction({ audioPrompt, languageLabel });
  const prompt = buildTurnPrompt({ history, userText });

  let replyText = '';
  let generationModel = conversationModel;
  let fallbackReason = null;

  try {
    replyText = await generateWithLiveText({
      ai,
      model: conversationModel,
      systemInstruction,
      prompt,
    });
  } catch (err) {
    fallbackReason = err.message;
    const fallback = await generateWithTextFallback({ ai, systemInstruction, prompt });
    replyText = fallback.text;
    generationModel = fallback.model;
  }

  const audioResult = await withAudioTimeout(
    previewAudio.generateSpeechAudio({
      voiceName: voiceName || 'Puck',
      prompt: replyText,
      selectedModel: liveModel,
      languageCode: resolvedLanguage,
      languageLabel,
      durationSeconds: 18,
    })
  );
  const audio = audioResult.audio || null;
  const audioError = audioResult.audioError || null;

  return {
    reply_text: replyText,
    language_code: resolvedLanguage,
    language_label: languageLabel,
    generation_model: generationModel,
    live_fallback_reason: fallbackReason,
    audio_generation_model: audio?.generationModel || null,
    audio_mime_type: audio?.mimeType || null,
    reply_audio_base64: audio?.audioBase64 || null,
    audio_error: audioError,
  };
};

const generateAgentReplyFromAudio = async ({
  liveModel,
  voiceName,
  audioPrompt,
  builderSettings,
  languageCode,
  history,
  audioBuffer,
  audioMimeType,
}) => {
  const startedAt = Date.now();
  const fastMode = String(process.env.JURINEX_VOICE_TEST_FAST_MODE || 'true') !== 'false';
  const generateServerTts = String(process.env.JURINEX_VOICE_TEST_GENERATE_TTS || 'false') === 'true';

  if (fastMode) {
    try {
      const fastReply = await generateFastAudioReply({
        audioBuffer,
        audioMimeType,
        audioPrompt,
        history,
        languageCode,
        selectedLanguages: builderSettings?.languages || [],
      });

      if (generateServerTts) {
        const audioResult = await withAudioTimeout(
          previewAudio.generateSpeechAudio({
            voiceName: voiceName || 'Puck',
            prompt: fastReply.reply_text,
            selectedModel: liveModel,
            languageCode: fastReply.language_code,
            languageLabel: fastReply.language_label,
            durationSeconds: 10,
          })
        );
        const audio = audioResult.audio || null;
        return {
          ...fastReply,
          live_fallback_reason: null,
          audio_generation_model: audio?.generationModel || null,
          audio_mime_type: audio?.mimeType || null,
          reply_audio_base64: audio?.audioBase64 || null,
          audio_error: audioResult.audioError || null,
          timings: {
            ...fastReply.timings,
            total_ms: Date.now() - startedAt,
          },
        };
      }

      return {
        ...fastReply,
        live_fallback_reason: null,
        audio_generation_model: null,
        audio_mime_type: null,
        reply_audio_base64: null,
        audio_error: 'server_tts_skipped_for_low_latency',
        timings: {
          ...fastReply.timings,
          total_ms: Date.now() - startedAt,
        },
      };
    } catch (err) {
      console.warn('[JURINEX_VOICE_TEST] fast audio turn failed; falling back to two-step path', {
        error: err.message,
        rawResponse: err.rawResponse ? String(err.rawResponse).slice(0, 300) : null,
      });
    }
  }

  const transcription = await transcribeUserAudio({
    audioBuffer,
    mimeType: audioMimeType,
    languageCode,
    selectedLanguages: builderSettings?.languages || [],
  });

  if (!transcription.transcript) {
    const err = new Error('I could not detect speech in the microphone audio. Please try speaking again.');
    err.code = 'EMPTY_TRANSCRIPT';
    err.transcription = transcription;
    throw err;
  }

  const reply = await generateAgentReply({
    liveModel,
    voiceName,
    audioPrompt,
    builderSettings,
    languageCode: transcription.language_code,
    history,
    userText: transcription.transcript,
  });

  return {
    user_text: transcription.transcript,
    transcription_model: transcription.model,
    fast_path: false,
    timings: {
      total_ms: Date.now() - startedAt,
    },
    ...reply,
  };
};

module.exports = {
  LANGUAGE_LABELS,
  buildSystemInstruction,
  createClient,
  generateAgentReply,
  generateAgentReplyFromAudio,
  normalizeLanguageCode,
  resolveConversationModel,
  streamAgentSpeechAudio,
  transcribeUserAudio,
};
