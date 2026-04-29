const https = require('https');

const SAMPLE_TEXT = (name) =>
  `Hello! I'm ${name}, your JuriNex AI legal assistant. I'm here to help you with legal research, case law, and platform guidance. How can I assist you today?`;

const TTS_MODEL    = 'gemini-2.5-flash-preview-tts';
const TTS_ENDPOINT = '/v1alpha';   // TTS requires v1alpha, not v1beta

// ── PCM → WAV conversion ──────────────────────────────────────────────────────
// Gemini TTS returns audio/L16;codec=pcm;rate=24000 — raw 16-bit LE mono PCM.
// Browsers cannot play raw PCM; we prepend a standard 44-byte WAV header.
function pcmToWav(pcmBuffer, sampleRate = 24000, channels = 1, bitDepth = 16) {
  const byteRate   = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);
  const dataSize   = pcmBuffer.length;
  const wav        = Buffer.alloc(44 + dataSize);

  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);          // PCM sub-chunk size
  wav.writeUInt16LE(1, 20);           // PCM format
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(byteRate, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bitDepth, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(wav, 44);

  return wav;
}

// ── Gemini TTS REST call ──────────────────────────────────────────────────────
function callGeminiTTS(voiceName, apiKey) {
  return new Promise((resolve, reject) => {
    // REST API requires camelCase keys — NOT snake_case
    const body = JSON.stringify({
      contents: [{ parts: [{ text: SAMPLE_TEXT(voiceName) }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const options = {
      hostname: 'generativelanguage.googleapis.com',
      path:     `${TTS_ENDPOINT}/models/${TTS_MODEL}:generateContent?key=${apiKey}`,
      method:   'POST',
      headers: {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let json;
        try { json = JSON.parse(raw); } catch (e) {
          return reject(new Error(`Gemini TTS: invalid JSON — ${raw.slice(0, 200)}`));
        }

        if (res.statusCode !== 200) {
          return reject(new Error(json.error?.message || `Gemini TTS HTTP ${res.statusCode}: ${raw.slice(0, 200)}`));
        }

        const inlineData = json.candidates?.[0]?.content?.parts?.[0]?.inlineData;
        if (!inlineData?.data) {
          return reject(new Error(`Gemini TTS returned no audio. Response: ${raw.slice(0, 300)}`));
        }

        const mimeType  = inlineData.mimeType || '';
        const pcmBuffer = Buffer.from(inlineData.data, 'base64');

        // Convert raw PCM (L16) to WAV so browsers can play it
        if (mimeType.includes('L16') || mimeType.includes('pcm')) {
          // Parse sample rate from mime type (e.g. audio/L16;codec=pcm;rate=24000)
          const rateMatch  = mimeType.match(/rate=(\d+)/);
          const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
          const wavBuffer  = pcmToWav(pcmBuffer, sampleRate);
          return resolve({ mimeType: 'audio/wav', data: wavBuffer.toString('base64') });
        }

        // Already a playable format (mp3, ogg, wav)
        resolve({ mimeType, data: inlineData.data });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// GET /api/admin/chatbot-config/voice-preview/:voiceName
const voicePreview = async (req, res) => {
  const { voiceName } = req.params;
  if (!voiceName || !/^[A-Za-z]+$/.test(voiceName)) {
    return res.status(400).json({ success: false, error: 'Invalid voice name' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, error: 'GEMINI_API_KEY not configured' });
  }

  try {
    const { mimeType, data } = await callGeminiTTS(voiceName, apiKey);
    return res.json({ success: true, mimeType, data });
  } catch (err) {
    console.error(`[voicePreview] ${voiceName}: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { voicePreview };
