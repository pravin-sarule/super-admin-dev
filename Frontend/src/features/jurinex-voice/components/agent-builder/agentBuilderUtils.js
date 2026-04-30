import {
  DEFAULT_AGENT_BUILDER_SETTINGS,
  FUNCTION_OPTIONS,
  LIVE_MODELS,
  PLATFORM_VOICES,
} from './agentBuilderConstants';

export const DEFAULT_AUDIO_PROMPT =
  'You are Preeti, a friendly and professional customer support voice agent for the Jurinex platform. You represent Jurinex Support. Start with a warm multilingual greeting, ask for the customer preferred language, and answer only from the available Jurinex records.';

const isPlainObject = (value) =>
  value != null && typeof value === 'object' && !Array.isArray(value);

export const mergeDeep = (base, override) => {
  if (!isPlainObject(base)) return override ?? base;
  const next = { ...base };
  Object.entries(override || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      next[key] = value;
    } else if (isPlainObject(value) && isPlainObject(base[key])) {
      next[key] = mergeDeep(base[key], value);
    } else if (value !== undefined) {
      next[key] = value;
    }
  });
  return next;
};

const stripRemovedBuilderFeatures = (settings = {}) => {
  const { handbook, ...rest } = settings || {};
  return rest;
};

export const getBuilderSettings = (config = {}, agent = {}) => {
  const saved = stripRemovedBuilderFeatures(config.custom_settings?.agent_builder || {});
  const languages = Array.isArray(agent.language_config?.languages)
    ? agent.language_config.languages
    : saved.languages;

  return stripRemovedBuilderFeatures(mergeDeep(DEFAULT_AGENT_BUILDER_SETTINGS, {
    ...saved,
    ...(languages ? { languages } : {}),
  }));
};

export const getVoiceMeta = (voiceName) =>
  PLATFORM_VOICES.find((voice) => voice.name === voiceName) || PLATFORM_VOICES[0];

export const normalizeModelOption = (model = {}) => {
  const id = model.id || model.model_id;
  if (!id) return null;

  const category = model.category || (String(id).includes('tts') ? 'tts' : 'live_audio');
  const total =
    model.cost ||
    (model.inr_one_minute_total != null
      ? `₹${Number(model.inr_one_minute_total).toFixed(2)}/min`
      : '');

  return {
    ...model,
    id,
    model_id: model.model_id || id,
    label: model.label || model.display_name || id,
    display_name: model.display_name || model.label || id,
    category,
    group: model.group || (category === 'live_audio' ? 'Live audio models' : 'Text-to-speech models'),
    cost: total,
    unit_pricing: model.unit_pricing || {},
    pricing_rows: Array.isArray(model.pricing_rows) ? model.pricing_rows : [],
  };
};

export const normalizeModelOptions = (models = LIVE_MODELS) => {
  const list = Array.isArray(models) && models.length ? models : LIVE_MODELS;
  return list.map(normalizeModelOption).filter(Boolean);
};

export const getModelMeta = (modelId, models = LIVE_MODELS) => {
  const options = normalizeModelOptions(models);
  return options.find((model) => model.id === modelId || model.model_id === modelId) || options[0] || LIVE_MODELS[0];
};

export const compactId = (value, prefix = 8, suffix = 4) => {
  if (!value) return '-';
  const text = String(value);
  if (text.length <= prefix + suffix + 3) return text;
  return `${text.slice(0, prefix)}...${text.slice(-suffix)}`;
};

export const formatTransferType = (value) =>
  String(value || 'warm')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

export const getEnabledFunctions = (builderSettings) => {
  const allowed = new Set(FUNCTION_OPTIONS.map((item) => item.key));
  return (builderSettings.functions || []).filter((item) => item.enabled !== false && allowed.has(item.key));
};

export const deriveWelcomeMessage = (prompt, builderSettings) => {
  const custom = builderSettings?.welcome?.message?.trim();
  if (custom) return custom;

  const promptText = String(prompt || DEFAULT_AUDIO_PROMPT).trim();
  const quoted = promptText.match(/"([^"]{12,180})"/);
  if (quoted?.[1]) return quoted[1];

  const firstSentence = promptText.split(/(?<=[.!?])\s+/)[0];
  return firstSentence || 'Hello, thank you for contacting Jurinex support. This is Preeti.';
};

export const buildSavePayload = ({
  config,
  builderSettings,
  audioPrompt,
  liveModel,
  voiceName,
  transferCall,
}) => {
  const voice = getVoiceMeta(voiceName);
  const cleanBuilderSettings = stripRemovedBuilderFeatures(builderSettings);
  return {
    ...config,
    live_model: liveModel,
    voice: voice.name,
    voice_tag: voice.style,
    system_prompts: {
      ...(config.system_prompts || {}),
      audio_live: audioPrompt,
    },
    transfer_call: transferCall,
    custom_settings: {
      ...(config.custom_settings || {}),
      agent_builder: cleanBuilderSettings,
    },
  };
};
