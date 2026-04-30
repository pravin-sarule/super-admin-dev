import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Play, Search, Square, X } from 'lucide-react';
import { getPlatformVoicePreview, listPlatformVoices } from '../../api/jurinexVoiceApi';
import { logVoiceBuilderFlow } from '../../utils/voiceDataflowLogger';
import { PLATFORM_VOICES } from './agentBuilderConstants';

const uniqueValues = (items, key) => [...new Set(items.map((item) => item[key]).filter(Boolean))];

const fallbackPreviewText = (voice, liveModel, languageCode) =>
  `Hello, this is ${voice.name}, a ${String(voice.style || '').toLowerCase()} ${voice.accent} Gemini Live voice for Jurinex support. I am previewing with ${liveModel} in ${languageCode}. I can greet callers, answer clearly, and keep the conversation calm, professional, and helpful.`;

const base64ToAudioData = (base64, mimeType = 'audio/wav') => {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return {
    arrayBuffer: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    blob: new Blob([bytes], { type: mimeType }),
  };
};

const playAudioElement = async ({ voice, preview, src }) => {
  const audio = new Audio(src);
  audio.preload = 'auto';
  return audio;
};

const VoiceSelectModal = ({
  open,
  selectedVoice,
  liveModel,
  selectedLanguages = [],
  agentId = null,
  onSelect,
  onClose,
}) => {
  const [gender, setGender] = useState('');
  const [accent, setAccent] = useState('');
  const [query, setQuery] = useState('');
  const [voices, setVoices] = useState(PLATFORM_VOICES);
  const [playingVoice, setPlayingVoice] = useState(null);
  const [loadingVoice, setLoadingVoice] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const previewTimerRef = useRef(null);
  const previewRequestRef = useRef(0);
  const previewCacheRef = useRef(new Map());
  const previewPendingRef = useRef(new Map());

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return voices.filter((voice) => {
      const matchesGender = !gender || voice.gender === gender;
      const matchesAccent = !accent || voice.accent === accent;
      const matchesQuery =
        !needle ||
        [voice.name, voice.style, voice.accent, voice.gender, voice.age]
          .join(' ')
          .toLowerCase()
          .includes(needle);
      return matchesGender && matchesAccent && matchesQuery;
    });
  }, [accent, gender, query, voices]);

  const selectedLanguage = useMemo(
    () => selectedLanguages.find((item) => item && item !== 'multi') || selectedLanguages[0] || 'en',
    [selectedLanguages]
  );

  const stopPreview = ({ cancelRequest = true } = {}) => {
    if (cancelRequest) {
      previewRequestRef.current += 1;
    }
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch {
        /* source may already be stopped */
      }
      audioSourceRef.current.onended = null;
      audioSourceRef.current = null;
    }
    if (audioUrlRef.current) {
      window.URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setPlayingVoice(null);
    setLoadingVoice(null);
  };

  useEffect(() => {
    return () => {
      stopPreview();
    };
  }, [open]);

  const unlockAudioContext = () => {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  };

  const markPreviewPlaying = (voice, preview) => {
    setLoadingVoice(null);
    setPlayingVoice(voice.name);
    logVoiceBuilderFlow({
      stage: 'voice_preview',
      eventType: 'platform_voice_preview_playing',
      message: 'Platform voice preview started playing',
      agentId,
      payload: {
        voice_key: voice.voice_key || voice.name,
        voice_name: voice.name,
        generation_source: preview.generation_source,
        generation_model: preview.generation_model,
        mime_type: preview.mime_type,
        audio_bytes: preview.audio_bytes,
      },
    });
  };

  const playWithAudioContext = async ({ voice, preview, arrayBuffer }) => {
    const context = unlockAudioContext();
    if (!context) {
      throw new Error('Audio playback is not available in this browser.');
    }
    const decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    const source = context.createBufferSource();
    source.buffer = decoded;
    source.connect(context.destination);
    source.onended = () => stopPreview();
    audioSourceRef.current = source;
    source.start(0);
    markPreviewPlaying(voice, preview);
  };

  useEffect(() => {
    if (!open) return;
    let ignore = false;

    listPlatformVoices()
      .then((data) => {
        if (!ignore && Array.isArray(data.voices) && data.voices.length) {
          setVoices(data.voices);
        }
      })
      .catch(() => {
        if (!ignore) setVoices(PLATFORM_VOICES);
      });

    return () => {
      ignore = true;
    };
  }, [open]);

  const playAudioPreview = async ({ voice, preview }) => {
    if (!preview?.audio_url && !preview?.audio_base64) {
      throw new Error('Preview audio URL was not returned by the server.');
    }

    let arrayBuffer = null;
    let url = preview.audio_url || null;
    if (!url && preview.audio_base64) {
      const audioData = base64ToAudioData(preview.audio_base64, preview.mime_type || 'audio/wav');
      arrayBuffer = audioData.arrayBuffer;
      url = window.URL.createObjectURL(audioData.blob);
      audioUrlRef.current = url;
    }

    const audio = await playAudioElement({ voice, preview, src: url });
    audioRef.current = audio;
    audio.onplay = () => markPreviewPlaying(voice, preview);
    audio.onended = () => stopPreview();
    audio.onerror = () => {
      setPreviewError('The preview audio loaded but could not be played by the browser.');
      stopPreview();
    };

    previewTimerRef.current = window.setTimeout(
      stopPreview,
      ((preview.duration_seconds || voice.preview_duration_seconds || 12) * 1000) + 750
    );

    try {
      await audio.play();
    } catch {
      audioRef.current = null;
      if (audioUrlRef.current) {
        window.URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      if (!arrayBuffer) {
        throw new Error('The stored preview recording could not be played by the browser.');
      }
      await playWithAudioContext({ voice, preview, arrayBuffer });
    }
  };

  const getPreviewCacheKey = (voice) =>
    [
      voice.voice_key || voice.name,
      liveModel,
      selectedLanguage,
      selectedLanguages.filter(Boolean).join(','),
    ].join('|');

  const fetchPreviewData = async (voice) => {
    const cacheKey = getPreviewCacheKey(voice);
    const cachedPreview = previewCacheRef.current.get(cacheKey);
    if (cachedPreview) {
      return {
        preview: {
          ...cachedPreview,
          cache_hit: true,
        },
      };
    }

    const pending = previewPendingRef.current.get(cacheKey);
    if (pending) return pending;

    const request = getPlatformVoicePreview(voice.voice_key || voice.name, {
      live_model: liveModel,
      language_code: selectedLanguage,
      selected_languages: selectedLanguages,
      agent_id: agentId,
    })
      .then((data) => {
        if (data.preview?.audio_url || data.preview?.audio_base64) {
          previewCacheRef.current.set(cacheKey, data.preview);
        }
        return data;
      })
      .finally(() => {
        previewPendingRef.current.delete(cacheKey);
      });

    previewPendingRef.current.set(cacheKey, request);
    return request;
  };

  const playPreview = async (event, voice) => {
    event.stopPropagation();

    if (playingVoice === voice.name) {
      stopPreview();
      return;
    }

    stopPreview();
    const requestToken = previewRequestRef.current;
    unlockAudioContext();
    setPreviewError('');
    setLoadingVoice(voice.name);

    try {
      logVoiceBuilderFlow({
        stage: 'voice_preview',
        eventType: 'platform_voice_preview_clicked',
        message: 'Platform voice preview play clicked',
        agentId,
        payload: {
          voice_key: voice.voice_key || voice.name,
          voice_name: voice.name,
          live_model: liveModel,
          language_code: selectedLanguage,
          selected_languages: selectedLanguages,
        },
      });
      const data = await fetchPreviewData(voice);
      if (requestToken !== previewRequestRef.current) return;
      logVoiceBuilderFlow({
        stage: 'voice_preview',
        eventType: 'platform_voice_preview_audio_received',
        message: 'Platform voice preview audio received',
        agentId,
        payload: {
          voice_key: voice.voice_key || voice.name,
          voice_name: voice.name,
          live_model: data.preview?.live_model,
          language_code: data.preview?.language_code,
          generation_source: data.preview?.generation_source,
          generation_model: data.preview?.generation_model,
          live_fallback_reason: data.preview?.live_fallback_reason,
          cache_hit: Boolean(data.preview?.cache_hit),
          mime_type: data.preview?.mime_type,
          audio_bytes: data.preview?.audio_bytes,
          audio_db_id: data.preview?.audio_db_id,
          audio_gcs_uri: data.preview?.audio_gcs_uri,
        },
      });
      await playAudioPreview({
        voice,
        preview: data.preview,
      });
    } catch (err) {
      if (requestToken !== previewRequestRef.current) return;
      stopPreview();
      logVoiceBuilderFlow({
        stage: 'voice_preview',
        eventType: 'platform_voice_preview_failed',
        message: 'Platform voice preview failed',
        agentId,
        payload: {
          voice_key: voice.voice_key || voice.name,
          voice_name: voice.name,
          live_model: liveModel,
          language_code: selectedLanguage,
          error: err?.message || 'Unknown preview error',
        },
        level: 'error',
      });
      setPreviewError(
        err?.message ||
          `Could not play ${voice.name}. ${fallbackPreviewText(voice, liveModel, selectedLanguage)}`
      );
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-3">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Select Voice</h3>
            <div className="mt-4 flex gap-5 text-sm font-semibold">
              <span className="border-b-2 border-blue-600 pb-2 text-blue-700">Platform Voices</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            aria-label="Close voice picker"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex flex-wrap gap-3 border-b border-slate-100 px-5 py-4">
          <select
            value={gender}
            onChange={(event) => setGender(event.target.value)}
            className="min-w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="">Gender</option>
            {uniqueValues(PLATFORM_VOICES, 'gender').map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <select
            value={accent}
            onChange={(event) => setAccent(event.target.value)}
            className="min-w-44 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="">Accent</option>
            {uniqueValues(PLATFORM_VOICES, 'accent').map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <label className="relative min-w-64 flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search..."
              className="w-full rounded-lg border border-slate-200 px-9 py-2 text-sm"
            />
          </label>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto p-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((voice) => {
            const selected = voice.name === selectedVoice;
            const playing = playingVoice === voice.name;
            const loading = loadingVoice === voice.name;
            return (
              <div
                key={voice.name}
                onClick={() => onSelect(voice)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(voice);
                  }
                }}
                role="button"
                tabIndex={0}
                className={`flex min-h-20 items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 text-left hover:border-blue-300 ${
                  selected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200'
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-200 to-blue-100 text-sm font-bold text-slate-700">
                    {voice.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-950">{voice.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {voice.accent} - {voice.age} - Gemini Live
                    </span>
                    <span className="block truncate text-xs text-slate-500">ID: gemini-{voice.name}</span>
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {selected && <Check className="h-4 w-4 text-slate-950" />}
                  <button
                    type="button"
                    onClick={(event) => playPreview(event, voice)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border ${
                      playing
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-slate-50'
                    }`}
                    aria-label={`${playing ? 'Stop' : 'Play'} ${voice.name} 12 second preview`}
                    title={`${playing ? 'Stop' : 'Play'} 12 second preview`}
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : playing ? (
                      <Square className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Play className="h-3.5 w-3.5 fill-current" />
                    )}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
        {previewError && (
          <div className="border-t border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">
            {previewError}
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceSelectModal;
