import { createDebugLogger } from '../../../utils/debugLogger';
import { recordVoiceDebugEvent } from '../api/jurinexVoiceApi';

const logger = createDebugLogger('JURINEX_VOICE_BUILDER');

const TRACE_KEY = 'jurinex_voice_builder_trace';

const createTraceId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `voice-builder-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const getVoiceBuilderTraceId = () => {
  if (typeof sessionStorage === 'undefined') return createTraceId();
  const existing = sessionStorage.getItem(TRACE_KEY);
  if (existing) return existing;
  const next = createTraceId();
  sessionStorage.setItem(TRACE_KEY, next);
  return next;
};

export const logVoiceBuilderFlow = async ({
  stage,
  message,
  agentId = null,
  eventType = 'agent_builder_ui',
  payload = {},
  persist = true,
  level = 'log',
}) => {
  const traceId = payload.trace_id || payload.traceId || getVoiceBuilderTraceId();
  const summary = {
    agentId,
    eventType,
    stage,
    traceId,
    message,
  };

  logger.flow(stage, {
    level,
    summary,
    context: payload,
    collapsed: false,
  });

  if (!persist) return;

  try {
    await recordVoiceDebugEvent({
      event_type: eventType,
      event_stage: stage,
      message,
      trace_id: traceId,
      agent_id: agentId,
      payload,
    });
  } catch (error) {
    logger.error('debug_event_persist_failed', error, {
      summary,
      context: { message },
    });
  }
};

export { logger as voiceBuilderLogger };
