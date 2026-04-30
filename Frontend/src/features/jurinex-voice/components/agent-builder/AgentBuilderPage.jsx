import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import {
  getVoiceAgentConfiguration,
  listVoiceModelPricing,
  listVoiceDocuments,
  updateVoiceAgentConfiguration,
} from '../../api/jurinexVoiceApi';
import { logVoiceBuilderFlow } from '../../utils/voiceDataflowLogger';
import AgentBuilderHeader from './AgentBuilderHeader';
import AgentPromptPanel from './AgentPromptPanel';
import AgentSettingsPanel from './AgentSettingsPanel';
import AgentTestPanel from './AgentTestPanel';
import VoiceSelectModal from './VoiceSelectModal';
import { LIVE_MODELS } from './agentBuilderConstants';
import {
  DEFAULT_AUDIO_PROMPT,
  buildSavePayload,
  getBuilderSettings,
  getVoiceMeta,
  normalizeModelOptions,
} from './agentBuilderUtils';

const DEFAULT_MODEL_ID = LIVE_MODELS[0].id;

const AgentBuilderPage = ({ agent, onBack, onSaved, onNavigateUpload }) => {
  const [config, setConfig] = useState(null);
  const [builderSettings, setBuilderSettings] = useState(getBuilderSettings({}, agent));
  const [audioPrompt, setAudioPrompt] = useState(agent.system_prompt || DEFAULT_AUDIO_PROMPT);
  const [liveModel, setLiveModel] = useState(DEFAULT_MODEL_ID);
  const [modelOptions, setModelOptions] = useState(() => normalizeModelOptions(LIVE_MODELS));
  const [voiceName, setVoiceName] = useState('Puck');
  const [transferCall, setTransferCall] = useState({});
  const [documents, setDocuments] = useState([]);
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const logBuilder = useCallback(
    (event) =>
      logVoiceBuilderFlow({
        agentId: agent.id,
        ...event,
      }),
    [agent.id]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await logBuilder({
        stage: 'agent_builder_opened',
        message: 'Admin opened voice agent builder',
        eventType: 'agent_builder_opened',
        payload: {
          agent_name: agent.name,
          display_name: agent.display_name,
        },
      });

      const [configData, documentData, pricingData] = await Promise.all([
        getVoiceAgentConfiguration(agent.id),
        listVoiceDocuments({ agent_id: agent.id, limit: 20 }),
        listVoiceModelPricing().catch((pricingErr) => ({
          success: false,
          models: LIVE_MODELS,
          error: pricingErr.message,
        })),
      ]);

      const pricingLoadedFromDb = pricingData.success !== false && Array.isArray(pricingData.models) && pricingData.models.length > 0;
      const nextModels = normalizeModelOptions(pricingData.models);
      const allowedModelIds = new Set(nextModels.map((item) => item.id));
      const nextConfig = configData.config || {};
      let nextBuilder = getBuilderSettings(nextConfig, configData.agent || agent);
      if (!allowedModelIds.has(nextBuilder.post_call_model)) {
        nextBuilder = {
          ...nextBuilder,
          post_call_model: nextModels[0]?.id || DEFAULT_MODEL_ID,
        };
      }
      const configuredModel = nextConfig.live_model || DEFAULT_MODEL_ID;
      const nextLiveModel = allowedModelIds.has(configuredModel)
        ? configuredModel
        : nextModels[0]?.id || DEFAULT_MODEL_ID;

      setConfig(nextConfig);
      setBuilderSettings(nextBuilder);
      setAudioPrompt(nextConfig.system_prompts?.audio_live || agent.system_prompt || DEFAULT_AUDIO_PROMPT);
      setLiveModel(nextLiveModel);
      setModelOptions(nextModels);
      setVoiceName(nextConfig.voice || 'Puck');
      setTransferCall(nextConfig.transfer_call || {});
      setDocuments(documentData.documents || []);

      await logBuilder({
        stage: 'agent_builder_data_ready',
        message: 'Agent builder data loaded in browser',
        eventType: 'agent_builder_data_ready',
        payload: {
          document_count: documentData.documents?.length || 0,
          model_count: nextModels.length,
          model_pricing_source: pricingLoadedFromDb ? 'database' : 'fallback_constants',
          model_pricing_error: pricingData.error || null,
          has_custom_settings: Boolean(nextConfig.custom_settings?.agent_builder),
          live_model: nextLiveModel,
          configured_live_model: nextConfig.live_model,
          voice: nextConfig.voice,
        },
      });
    } catch (err) {
      setError(err.message);
      await logBuilder({
        stage: 'agent_builder_load_failed',
        message: 'Agent builder failed to load',
        eventType: 'agent_builder_load_failed',
        level: 'error',
        payload: {
          error: err.message,
        },
      });
    } finally {
      setLoading(false);
    }
  }, [agent, logBuilder]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    const payload = buildSavePayload({
      config,
      builderSettings,
      audioPrompt,
      liveModel,
      voiceName,
      transferCall,
    });

    try {
      await logBuilder({
        stage: 'agent_builder_publish_started',
        message: 'Admin started publishing agent builder configuration',
        eventType: 'agent_builder_publish_started',
        payload: {
          live_model: liveModel,
          voice: voiceName,
          prompt_chars: audioPrompt.length,
          function_count: builderSettings.functions?.length || 0,
        },
      });

      const data = await updateVoiceAgentConfiguration(agent.id, payload);
      const nextConfig = data.config || payload;
      setConfig(nextConfig);
      setBuilderSettings(getBuilderSettings(nextConfig, data.agent || agent));
      setLastSavedAt(new Date());
      onSaved?.(data.agent);

      await logBuilder({
        stage: 'agent_builder_publish_completed',
        message: 'Agent builder configuration published',
        eventType: 'agent_builder_publish_completed',
        payload: {
          live_model: nextConfig.live_model,
          voice: nextConfig.voice,
          language_count: builderSettings.languages?.length || 0,
        },
      });
    } catch (err) {
      setError(err.message);
      await logBuilder({
        stage: 'agent_builder_publish_failed',
        message: 'Agent builder publish failed',
        eventType: 'agent_builder_publish_failed',
        level: 'error',
        payload: {
          error: err.message,
        },
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLiveModelChange = (model) => {
    setLiveModel(model);
    logBuilder({
      stage: 'live_model_changed',
      message: 'Admin changed live model',
      eventType: 'agent_builder_field_changed',
      payload: { field: 'live_model', value: model },
    });
  };

  const handleVoiceSelect = (voice) => {
    setVoiceName(voice.name);
    setBuilderSettings((prev) => ({
      ...prev,
      voice_profile: {
        name: voice.name,
        style: voice.style,
        accent: voice.accent,
        gender: voice.gender,
      },
    }));
    setVoiceModalOpen(false);
    logBuilder({
      stage: 'voice_changed',
      message: 'Admin changed voice',
      eventType: 'agent_builder_field_changed',
      payload: {
        field: 'voice',
        voice: voice.name,
        style: voice.style,
      },
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-slate-200 bg-white">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm font-medium text-slate-700">Loading agent builder...</p>
        </div>
      </div>
    );
  }

  const selectedVoice = getVoiceMeta(voiceName);

  return (
    <div className="space-y-3">
      <AgentBuilderHeader
        agent={agent}
        liveModel={liveModel}
        models={modelOptions}
        onBack={onBack}
        onSave={handleSave}
        saving={saving}
        lastSavedAt={lastSavedAt}
      />

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[minmax(440px,1.15fr)_minmax(360px,0.62fr)_minmax(320px,0.55fr)]">
        <AgentPromptPanel
          agent={agent}
          liveModel={liveModel}
          models={modelOptions}
          onLiveModelChange={handleLiveModelChange}
          voiceName={voiceName}
          onOpenVoiceModal={() => setVoiceModalOpen(true)}
          builderSettings={builderSettings}
          onBuilderSettingsChange={setBuilderSettings}
          audioPrompt={audioPrompt}
          onAudioPromptChange={setAudioPrompt}
        />
        <AgentSettingsPanel
          builderSettings={builderSettings}
          onBuilderSettingsChange={setBuilderSettings}
          models={modelOptions}
          transferCall={transferCall}
          onTransferCallChange={setTransferCall}
          documents={documents}
          onNavigateUpload={onNavigateUpload}
        />
        <AgentTestPanel
          agentId={agent.id}
          liveModel={liveModel}
          models={modelOptions}
          voiceName={selectedVoice.name}
          builderSettings={builderSettings}
          audioPrompt={audioPrompt}
          onLog={logBuilder}
        />
      </div>

      <VoiceSelectModal
        open={voiceModalOpen}
        selectedVoice={voiceName}
        liveModel={liveModel}
        selectedLanguages={builderSettings.languages || []}
        agentId={agent.id}
        onSelect={handleVoiceSelect}
        onClose={() => setVoiceModalOpen(false)}
      />
    </div>
  );
};

export default AgentBuilderPage;
