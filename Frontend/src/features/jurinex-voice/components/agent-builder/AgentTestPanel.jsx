import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Info,
  Loader2,
  Mic,
  Phone,
  Play,
  Square,
  Volume2,
} from 'lucide-react';
import { getVoiceAgentLiveTestUrl } from '../../api/jurinexVoiceApi';
import { deriveWelcomeMessage, getModelMeta, getVoiceMeta } from './agentBuilderUtils';

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const INPUT_MIME_TYPE = 'audio/pcm;rate=16000';

const resolveSpeechLanguage = (languages = []) => {
  const clean = languages.filter((item) => item && item !== 'multi');
  const first = clean[0] || 'en';
  if (first === 'en') return 'en-US';
  if (first === 'hi') return 'hi-IN';
  if (first === 'mr') return 'mr-IN';
  return first;
};

const phaseLabel = {
  requesting_mic: 'Waiting for microphone permission',
  connecting: 'Connecting live call',
  ready: 'Ready',
  listening: 'Listening to microphone',
  speaking: 'Agent speaking',
  interrupted: 'Caller interrupted agent',
};

const debugLive = (event, summary = {}, context = {}) => {
  if (typeof console === 'undefined') return;
  console.groupCollapsed(`[JURINEX_VOICE_LIVE] ${event}`);
  console.log('summary', summary);
  console.log('context', context);
  console.groupEnd();
};

// Per-test pipeline tracer: records each stage transition with timestamps
// and counters, prints a styled console line per stage, and dumps the full
// timeline with computed latencies on test end. Lets you see exactly where
// the live pipeline broke without scrolling through hundreds of unrelated
// log lines.
const createPipelineTracer = (label) => {
  const startedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const stageTimes = { test_start: startedAt };
  const marks = [];
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

  const mark = (stage, payload = {}) => {
    const t = now();
    if (!stageTimes[stage]) stageTimes[stage] = t;
    const tFromStart = Math.round(t - startedAt);
    const entry = { stage, t_ms: tFromStart, ...payload };
    marks.push(entry);
    if (typeof console !== 'undefined') {
      console.log(
        `%c[PIPELINE ${label}] %c+${(tFromStart / 1000).toFixed(2)}s %c→ ${stage}`,
        'color:#0ea5e9;font-weight:600',
        'color:#64748b',
        'color:#0f172a;font-weight:600',
        payload
      );
    }
  };

  const sinceStage = (stage) => (stageTimes[stage] ? Math.round(now() - stageTimes[stage]) : null);

  const summary = (final = {}) => {
    if (typeof console === 'undefined') return marks;
    const totalMs = Math.round(now() - startedAt);
    console.groupCollapsed(
      `%c[PIPELINE ${label}] FINAL TIMELINE (${(totalMs / 1000).toFixed(2)}s, ${marks.length} stages)`,
      'color:#0ea5e9;font-weight:700'
    );
    console.table(marks.map(({ stage, t_ms, ...rest }) => ({ stage, t_ms, ...rest })));
    console.log('final', final);
    console.groupEnd();
    return marks;
  };

  return { mark, summary, sinceStage };
};

const base64ToArrayBuffer = (base64) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
};

const arrayBufferToBase64 = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const parseSampleRate = (mimeType = '') => {
  const match = String(mimeType).match(/rate=(\d+)/i);
  return match ? Number(match[1]) : OUTPUT_SAMPLE_RATE;
};

const downsampleFloat32 = (input, sourceRate, targetRate) => {
  if (sourceRate === targetRate) return input;
  const ratio = sourceRate / targetRate;
  const outputLength = Math.max(1, Math.round(input.length / ratio));
  const output = new Float32Array(outputLength);

  for (let outputIndex = 0; outputIndex < outputLength; outputIndex += 1) {
    const start = Math.floor(outputIndex * ratio);
    const end = Math.min(input.length, Math.floor((outputIndex + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let inputIndex = start; inputIndex < end; inputIndex += 1) {
      sum += input[inputIndex];
      count += 1;
    }
    output[outputIndex] = count ? sum / count : input[start] || 0;
  }

  return output;
};

const float32ToPcm16Buffer = (float32) => {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view = new DataView(buffer);
  for (let index = 0; index < float32.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, float32[index]));
    view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return buffer;
};

const AgentTestPanel = ({
  agentId,
  liveModel,
  models,
  voiceName,
  builderSettings,
  audioPrompt,
  onLog,
}) => {
  const [audioRunning, setAudioRunning] = useState(false);
  const [phase, setPhase] = useState('ready');
  const [messages, setMessages] = useState([]);
  const [captureLevel, setCaptureLevel] = useState(0);
  const [error, setError] = useState(null);
  const [statusText, setStatusText] = useState('Ready');

  const streamRef = useRef(null);
  const captureContextRef = useRef(null);
  const captureSourceRef = useRef(null);
  const captureProcessorRef = useRef(null);
  const playbackContextRef = useRef(null);
  const playbackCursorRef = useRef(0);
  const wsRef = useRef(null);
  const runningRef = useRef(false);
  const messagesRef = useRef([]);
  const inputTranscriptRef = useRef('');
  const outputTranscriptRef = useRef('');
  const pendingWelcomeRef = useRef('');
  const playbackChunkCountRef = useRef(0);
  const sentPacketCountRef = useRef(0);
  const lastLevelUpdateRef = useRef(0);
  const sessionIdRef = useRef(null);
  const captureStartedRef = useRef(false);
  const pipelineRef = useRef(null);

  const welcomeMessage = deriveWelcomeMessage(audioPrompt, builderSettings);
  const model = getModelMeta(liveModel, models);
  const voice = getVoiceMeta(voiceName);
  const languageCode = resolveSpeechLanguage(builderSettings.languages || []);

  const logTest = (eventType, stage, message, payload = {}) => {
    const fullPayload = {
      live_model: liveModel,
      voice: voice.name,
      language_code: languageCode,
      session_id: sessionIdRef.current,
      ...payload,
    };
    debugLive(eventType, {
      stage,
      agentId,
      phase,
      ...fullPayload,
    });
    onLog?.({
      stage,
      message,
      eventType,
      payload: fullPayload,
    });
  };

  const setConversationMessages = (nextMessages) => {
    messagesRef.current = nextMessages;
    setMessages(nextMessages);
  };

  const appendMessage = (message) => {
    const cleanText = String(message.text || '').trim();
    if (!cleanText) return messagesRef.current;

    const next = [
      ...messagesRef.current,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ...message,
        text: cleanText,
      },
    ];
    setConversationMessages(next);
    return next;
  };

  const stopCapture = () => {
    captureProcessorRef.current?.disconnect?.();
    captureSourceRef.current?.disconnect?.();
    captureContextRef.current?.close?.().catch?.(() => {});
    captureProcessorRef.current = null;
    captureSourceRef.current = null;
    captureContextRef.current = null;
    streamRef.current?.getTracks?.().forEach((track) => track.stop());
    streamRef.current = null;
    setCaptureLevel(0);
  };

  const stopPlayback = () => {
    playbackContextRef.current?.close?.().catch?.(() => {});
    playbackContextRef.current = null;
    playbackCursorRef.current = 0;
    playbackChunkCountRef.current = 0;
  };

  const cleanupAudioTest = ({ notifyServer = true } = {}) => {
    runningRef.current = false;
    stopCapture();
    stopPlayback();
    if (notifyServer && wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'end' }));
    }
    wsRef.current?.close?.();
    wsRef.current = null;
    sentPacketCountRef.current = 0;
    inputTranscriptRef.current = '';
    outputTranscriptRef.current = '';
    pendingWelcomeRef.current = '';
    sessionIdRef.current = null;
    captureStartedRef.current = false;
  };

  useEffect(() => () => cleanupAudioTest({ notifyServer: false }), []);

  const ensurePlaybackContext = async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio playback is not available in this browser.');

    if (!playbackContextRef.current || playbackContextRef.current.state === 'closed') {
      playbackContextRef.current = new AudioContextClass({ sampleRate: OUTPUT_SAMPLE_RATE });
      playbackCursorRef.current = playbackContextRef.current.currentTime + 0.04;
    }
    if (playbackContextRef.current.state === 'suspended') {
      await playbackContextRef.current.resume();
    }
    if (playbackCursorRef.current < playbackContextRef.current.currentTime + 0.03) {
      playbackCursorRef.current = playbackContextRef.current.currentTime + 0.03;
    }
    return playbackContextRef.current;
  };

  const playStreamingAudioChunk = async ({ data, mime_type: mimeType }) => {
    if (!data) return;
    const context = await ensurePlaybackContext();
    const arrayBuffer = base64ToArrayBuffer(data);
    let audioBuffer = null;

    if (/pcm|L16/i.test(mimeType || '')) {
      const sampleRate = parseSampleRate(mimeType);
      const pcm = new Int16Array(arrayBuffer);
      audioBuffer = context.createBuffer(1, pcm.length, sampleRate);
      const channel = audioBuffer.getChannelData(0);
      for (let index = 0; index < pcm.length; index += 1) {
        channel[index] = Math.max(-1, Math.min(1, pcm[index] / 32768));
      }
    } else {
      audioBuffer = await context.decodeAudioData(arrayBuffer.slice(0));
    }

    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    const startAt = Math.max(playbackCursorRef.current, context.currentTime + 0.02);
    source.start(startAt);
    playbackCursorRef.current = startAt + audioBuffer.duration;
    playbackChunkCountRef.current += 1;

    if (playbackChunkCountRef.current === 1 || playbackChunkCountRef.current % 20 === 0) {
      debugLive('audio_chunk_scheduled', {
        chunks: playbackChunkCountRef.current,
        mimeType,
        durationMs: Math.round(audioBuffer.duration * 1000),
        playbackDelayMs: Math.round((startAt - context.currentTime) * 1000),
      });
    }
  };

  const flushInputTranscript = (finalText = '') => {
    const text = String(finalText || inputTranscriptRef.current || '').trim();
    if (!text) return;
    inputTranscriptRef.current = '';
    appendMessage({ role: 'user', text });
  };

  const flushOutputTranscript = (finalText = '') => {
    const text = String(finalText || outputTranscriptRef.current || pendingWelcomeRef.current || '').trim();
    if (!text) return;
    outputTranscriptRef.current = '';
    pendingWelcomeRef.current = '';
    appendMessage({ role: 'assistant', text });
  };

  const handleSocketMessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.session_id) sessionIdRef.current = data.session_id;

    const beginMicrophoneStreaming = () => {
      if (!captureStartedRef.current && streamRef.current && wsRef.current?.readyState === WebSocket.OPEN) {
        captureStartedRef.current = true;
        startPcmStreaming(streamRef.current, wsRef.current)
          .then(() => {
            logTest('agent_test_live_capture_started', 'live_test_capture', 'Browser PCM microphone streaming started', {
              input_mime_type: INPUT_MIME_TYPE,
              packets_sent: sentPacketCountRef.current,
            });
          })
          .catch((err) => {
            setError(`Microphone streaming failed: ${err.message}`);
            logTest('agent_test_live_capture_failed', 'live_test_capture', 'Browser PCM microphone streaming failed', {
              error: err.message,
            });
          });
      }
    };

    const trace = pipelineRef.current;

    switch (data.type) {
      case 'socket_ready':
        trace?.mark('socket_ready');
        setStatusText('Socket ready');
        break;
      case 'model_socket_open':
        trace?.mark('model_socket_open', { live_model: data.live_model, voice: data.voice_name });
        setStatusText('Live model connected');
        break;
      case 'session_started':
        trace?.mark('session_started');
        setStatusText('Live session created');
        break;
      case 'model_ready':
        trace?.mark('model_ready', {
          latency_from_ws_open_ms: trace?.sinceStage('ws_open'),
        });
        setStatusText('Live model ready');
        break;
      case 'listening_ready':
        trace?.mark('listening_ready', { reason: data.reason });
        setPhase('listening');
        setStatusText('Listening to microphone');
        beginMicrophoneStreaming();
        break;
      case 'welcome_started':
        trace?.mark('welcome_started', { text_preview: String(data.text || '').slice(0, 60) });
        pendingWelcomeRef.current = data.text || welcomeMessage;
        setPhase('speaking');
        setStatusText('Agent greeting');
        break;
      case 'audio_chunk':
        if (playbackChunkCountRef.current === 0) {
          trace?.mark('audio_out_first', {
            mime_type: data.mime_type,
            byte_length: data.byte_length,
            latency_from_ws_open_ms: trace?.sinceStage('ws_open'),
            latency_from_listening_ready_ms: trace?.sinceStage('listening_ready'),
          });
        }
        if (pendingWelcomeRef.current && playbackChunkCountRef.current === 0) {
          flushOutputTranscript(pendingWelcomeRef.current);
        }
        setPhase('speaking');
        setStatusText('Streaming agent audio');
        playStreamingAudioChunk(data).catch((err) => {
          setError(`Audio playback failed: ${err.message}`);
          logTest('agent_test_live_playback_failed', 'live_test_playback', 'Live audio playback failed in browser', {
            error: err.message,
            mime_type: data.mime_type,
            chunk_index: data.index,
          });
        });
        break;
      case 'input_transcript':
        if (!inputTranscriptRef.current) {
          trace?.mark('input_transcript_first', { text_preview: String(data.text || '').slice(0, 60) });
        }
        inputTranscriptRef.current = data.text || inputTranscriptRef.current;
        if (data.final) flushInputTranscript(data.text);
        break;
      case 'output_transcript':
        if (!outputTranscriptRef.current) {
          trace?.mark('output_transcript_first', { text_preview: String(data.text || '').slice(0, 60) });
        }
        outputTranscriptRef.current += data.text || '';
        if (data.final) flushOutputTranscript(outputTranscriptRef.current);
        break;
      case 'text_delta':
        outputTranscriptRef.current += data.text || '';
        break;
      case 'turn_complete':
        trace?.mark('turn_complete', {
          generation_complete: Boolean(data.generation_complete),
          turn_complete: Boolean(data.turn_complete),
        });
        flushInputTranscript();
        flushOutputTranscript();
        if (runningRef.current) {
          setPhase('listening');
          setStatusText('Listening to microphone');
        }
        break;
      case 'interrupted':
        trace?.mark('interrupted');
        setPhase('interrupted');
        setStatusText('Caller interrupted agent');
        break;
      case 'error':
        trace?.mark('error', { message: data.message, detail: data.error || null });
        setError(data.message || 'Live call failed.');
        logTest('agent_test_live_socket_error', 'live_test_socket', 'Live test socket returned an error', {
          error: data.message,
          detail: data.error || null,
        });
        break;
      case 'tool_session_end':
        trace?.mark('tool_session_end', {
          reason: data.reason,
          source: data.source,
          transfer: data.transfer || null,
          agent_transfer: data.agent_transfer || null,
        });
        if (data.transfer?.destination) {
          setStatusText(`Transferring to ${data.transfer.destination}…`);
        } else if (data.agent_transfer?.to_agent_name) {
          setStatusText(`Handing off to ${data.agent_transfer.to_agent_name}…`);
        } else {
          setStatusText('Ending call…');
        }
        break;
      case 'model_socket_closed':
        trace?.mark('model_socket_closed', {
          code: data.code,
          reason: data.reason,
          fatal: data.fatal,
          unsupported: data.unsupported,
          latency_from_ws_open_ms: trace?.sinceStage('ws_open'),
        });
        stopCapture();
        if (data.unsupported) {
          setStatusText('Live audio not enabled for this model/key');
          setError(
            data.reason ||
              'Gemini Live closed because this audio operation is not enabled for the selected model or API key.'
          );
        } else if (data.fatal) {
          setStatusText('Live model socket closed');
          setError(data.reason || 'Live model socket closed before returning audio.');
        }
        debugLive('model_socket_closed', data);
        break;
      default:
        debugLive('unhandled_socket_message', data);
    }
  };

  const startPcmStreaming = async (stream, ws) => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) throw new Error('Web Audio capture is not available in this browser.');

    const context = new AudioContextClass();
    await context.resume();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(2048, 1, 1);

    processor.onaudioprocess = (event) => {
      if (!runningRef.current || ws.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const downsampled = downsampleFloat32(input, context.sampleRate, INPUT_SAMPLE_RATE);
      const pcmBuffer = float32ToPcm16Buffer(downsampled);

      let sum = 0;
      for (let index = 0; index < downsampled.length; index += 1) {
        sum += downsampled[index] * downsampled[index];
      }
      const rms = Math.sqrt(sum / downsampled.length);
      const now = performance.now();
      if (now - lastLevelUpdateRef.current > 90) {
        setCaptureLevel(Math.min(1, rms * 12));
        lastLevelUpdateRef.current = now;
      }

      ws.send(
        JSON.stringify({
          type: 'audio_chunk',
          mime_type: INPUT_MIME_TYPE,
          data: arrayBufferToBase64(pcmBuffer),
        })
      );

      sentPacketCountRef.current += 1;
      if (sentPacketCountRef.current === 1) {
        pipelineRef.current?.mark('mic_first_packet', {
          source_rate: context.sampleRate,
          target_rate: INPUT_SAMPLE_RATE,
          bytes: pcmBuffer.byteLength,
          latency_from_listening_ready_ms: pipelineRef.current?.sinceStage('listening_ready'),
        });
      }
      if (sentPacketCountRef.current === 1 || sentPacketCountRef.current % 50 === 0) {
        debugLive('mic_packet_sent', {
          packets: sentPacketCountRef.current,
          sourceSampleRate: context.sampleRate,
          targetSampleRate: INPUT_SAMPLE_RATE,
          bytes: pcmBuffer.byteLength,
          rms: Number(rms.toFixed(4)),
        });
      }
    };

    source.connect(processor);
    processor.connect(context.destination);
    captureContextRef.current = context;
    captureSourceRef.current = source;
    captureProcessorRef.current = processor;

    debugLive('pcm_streaming_started', {
      sourceSampleRate: context.sampleRate,
      targetSampleRate: INPUT_SAMPLE_RATE,
      bufferSize: processor.bufferSize,
      inputMimeType: INPUT_MIME_TYPE,
    });
  };

  const runAudioTest = async () => {
    setError(null);
    setStatusText('Requesting microphone');
    setPhase('requesting_mic');

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone access is not available in this browser.');
      setPhase('ready');
      setStatusText('Ready');
      return;
    }

    try {
      logTest('agent_test_live_mic_permission_requested', 'live_test_permission', 'Browser microphone permission requested');
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      streamRef.current = stream;
      runningRef.current = true;
      setAudioRunning(true);
      setConversationMessages([]);
      pendingWelcomeRef.current = builderSettings.welcome?.speaker === 'user_first' ? '' : welcomeMessage;
      playbackChunkCountRef.current = 0;
      sentPacketCountRef.current = 0;

      pipelineRef.current = createPipelineTracer(`${liveModel}/${voice.name}`);
      pipelineRef.current.mark('test_start', {
        live_model: liveModel,
        voice: voice.name,
        language_code: languageCode,
        speaker: builderSettings.welcome?.speaker || 'ai_first',
      });

      const wsUrl = getVoiceAgentLiveTestUrl(agentId);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      setPhase('connecting');
      setStatusText('Connecting live call');

      ws.onopen = async () => {
        pipelineRef.current?.mark('ws_open');
        debugLive('socket_open', {
          agentId,
          model: liveModel,
          voice: voice.name,
          languageCode,
          url: wsUrl.replace(/([?&](?:admin_key|token)=)[^&]+/g, '$1[redacted]'),
        });
        ws.send(
          JSON.stringify({
            type: 'start',
            live_model: liveModel,
            voice_name: voice.name,
            audio_prompt: audioPrompt,
            builder_settings: builderSettings,
            language_code: languageCode,
            selected_languages: builderSettings.languages || [],
            welcome_message: welcomeMessage,
            speaker: builderSettings.welcome?.speaker || 'ai_first',
            input_mime_type: INPUT_MIME_TYPE,
          })
        );
        logTest('agent_test_live_started', 'live_test_socket', 'Admin started realtime voice-agent audio test', {
          model_label: model.label,
          input_mime_type: INPUT_MIME_TYPE,
          echo_cancellation: true,
          streaming_mode: 'browser_pcm_to_gemini_live_websocket',
        });
      };

      ws.onmessage = handleSocketMessage;

      ws.onerror = (event) => {
        debugLive('socket_error', { event });
        setError('Live call socket error. Check backend and browser console logs.');
        setPhase('ready');
        setStatusText('Socket error');
      };

      ws.onclose = (event) => {
        pipelineRef.current?.mark('ws_close', {
          code: event.code,
          reason: event.reason,
          packets_sent: sentPacketCountRef.current,
          playback_chunks: playbackChunkCountRef.current,
        });
        pipelineRef.current?.summary({
          ws_code: event.code,
          ws_reason: event.reason,
          packets_sent: sentPacketCountRef.current,
          playback_chunks: playbackChunkCountRef.current,
        });
        pipelineRef.current = null;
        debugLive('socket_closed', {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          packetsSent: sentPacketCountRef.current,
          playbackChunks: playbackChunkCountRef.current,
        });
        if (runningRef.current && event.code !== 1000) {
          setError(event.reason || 'Live call socket closed unexpectedly.');
        }
        cleanupAudioTest({ notifyServer: false });
        setAudioRunning(false);
        setPhase('ready');
        setStatusText('Ready');
      };
    } catch (err) {
      cleanupAudioTest({ notifyServer: false });
      setAudioRunning(false);
      debugLive('live_test_start_failed', { name: err.name, message: err.message });
      logTest('agent_test_live_start_failed', 'live_test_permission', 'Realtime voice-agent test failed to start', {
        error_name: err.name,
        error: err.message,
      });
      setError(err.name === 'NotAllowedError' ? 'Microphone permission was denied.' : err.message);
      setPhase('ready');
      setStatusText('Ready');
    }
  };

  const endAudioTest = () => {
    const messageCount = messagesRef.current.length;
    cleanupAudioTest({ notifyServer: true });
    setAudioRunning(false);
    setPhase('ready');
    setStatusText('Ready');
    onLog?.({
      stage: 'live_test_ended',
      message: 'Admin ended realtime voice-agent audio test',
      eventType: 'agent_test_live_ended',
      payload: {
        live_model: liveModel,
        voice: voice.name,
        message_count: messageCount,
        packets_sent: sentPacketCountRef.current,
        audio_chunks_played: playbackChunkCountRef.current,
      },
    });
  };

  return (
    <aside className="flex min-h-[680px] flex-col rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center gap-2 border-b border-slate-200 p-3">
        <button
          type="button"
          className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-white text-sm font-semibold text-slate-950 shadow-sm ring-1 ring-slate-200"
        >
          <Phone className="h-4 w-4" />
          Test Audio
        </button>
      </div>

      <div className="flex flex-1 flex-col p-4">
        {!audioRunning ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Mic className="mb-7 h-14 w-14 text-slate-300" />
            <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
              <Info className="h-3.5 w-3.5" />
              Realtime audio uses your microphone until you end the call.
            </div>
            {error && (
              <div className="mb-3 flex max-w-sm items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-left text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={runAudioTest}
              disabled={phase === 'requesting_mic' || phase === 'connecting'}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-50 disabled:opacity-60"
            >
              {phase === 'requesting_mic' || phase === 'connecting' ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {phase === 'requesting_mic' ? 'Allow mic...' : phase === 'connecting' ? 'Connecting...' : 'Run Test'}
            </button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600">
              <span className="inline-flex min-w-0 items-center gap-2">
                {phase === 'listening' ? (
                  <Mic className="h-3.5 w-3.5 text-blue-600" />
                ) : phase === 'connecting' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5 text-slate-500" />
                )}
                <span className="truncate">{phaseLabel[phase] || statusText}</span>
              </span>
              <span className="shrink-0">{languageCode}</span>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-lg px-3 py-2 text-sm leading-6 ${
                      message.role === 'user'
                        ? 'bg-slate-900 text-white'
                        : 'bg-blue-50 text-slate-700'
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              ))}

              <div className="flex justify-end">
                <div className="max-w-[88%] rounded-lg bg-slate-100 px-3 py-2 text-sm leading-6 text-slate-500">
                  {statusText}
                  <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-slate-200">
                    <span
                      className="block h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${Math.max(6, Math.round(captureLevel * 100))}%` }}
                    />
                  </span>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="mt-4 border-t border-slate-200 pt-4 text-center">
              <button
                type="button"
                onClick={endAudioTest}
                className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <Square className="h-3.5 w-3.5" />
                End the Call
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default AgentTestPanel;
