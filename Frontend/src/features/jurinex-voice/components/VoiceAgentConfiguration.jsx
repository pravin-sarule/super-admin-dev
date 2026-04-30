import AgentBuilderPage from './agent-builder/AgentBuilderPage';

export default AgentBuilderPage;

/*
Legacy configuration UI retained below as an inline reference while the
structured agent-builder implementation lives in ./agent-builder.

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Bot,
  ChevronDown,
  MessageSquare,
  Mic,
  Music,
  PhoneForwarded,
  RotateCcw,
  Save,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';
import { getVoiceAgentConfiguration, updateVoiceAgentConfiguration } from '../api/jurinexVoiceApi';

const VOICES = [
  { name: 'Puck', tag: 'Upbeat' },
  { name: 'Charon', tag: 'Bright' },
  { name: 'Kore', tag: 'Clear' },
  { name: 'Fenrir', tag: 'Distinct' },
  { name: 'Leda', tag: 'Calm' },
  { name: 'Orus', tag: 'Clear' },
  { name: 'Aoede', tag: 'Bright' },
  { name: 'Callirrhoe', tag: 'Calm' },
  { name: 'Despina', tag: 'Calm' },
  { name: 'Algieba', tag: 'Calm' },
  { name: 'Achernar', tag: 'Calm' },
  { name: 'Schedar', tag: 'Distinct' },
  { name: 'Achird', tag: 'Distinct' },
  { name: 'Sadachbia', tag: 'Distinct' },
  { name: 'Enceladus', tag: 'Distinct' },
  { name: 'Algenib', tag: 'Distinct' },
  { name: 'Gacrux', tag: 'Distinct' },
  { name: 'Zubenelgenubi', tag: 'Distinct' },
  { name: 'Sadaltager', tag: 'Distinct' },
  { name: 'Rasalgethi', tag: 'Distinct' },
  { name: 'Pulcherrima', tag: 'Bright' },
  { name: 'Vindemiatrix', tag: 'Clear' },
  { name: 'Sulafat', tag: 'Calm' },
];

const DEFAULT_TEXT_PROMPT =
  'You are the Nexintel AI Support Agent. Provide fast, accurate solutions based ONLY on the provided document context. If the answer is not found, state: "I am sorry, I do not have information on that in our records." Keep responses under 3 sentences.';

const DEFAULT_AUDIO_PROMPT =
  'You are the Nexintel AI Support Agent. Provide fast, accurate answers based ONLY on documents retrieved via search_documents. Keep spoken responses under 20 seconds.';

const defaultConfig = {
  text_model: 'gemini-1.5-flash',
  live_model: 'gemini-3.1-flash-live-preview',
  voice: 'Puck',
  voice_tag: 'Upbeat',
  temperature: 0.1,
  top_p: 0.95,
  max_tokens: 150,
  top_k_results: 5,
  system_prompts: {
    text_chat: DEFAULT_TEXT_PROMPT,
    audio_live: DEFAULT_AUDIO_PROMPT,
  },
  transfer_call: {
    name: 'transfer_call',
    description: 'Transfer the call to a human agent',
    routing_mode: 'dynamic',
    destination_prompt:
      'If the user wants to reach support, transfer to +1 (925) 222-2222; if the user wants to reach sales, transfer to +1 (925) 333-3333',
    e164_format: true,
    transfer_type: 'warm',
    on_hold_music: 'Ringtone',
    ring_duration_seconds: 30,
    navigate_ivr: false,
    internal_queue: true,
    agent_wait_seconds: 30,
    whisper_debrief: false,
    three_way_ring_tone: true,
    three_way_debrief: true,
    handoff_mode: 'prompt',
    handoff_message: 'Continue translating for the customer and the technician',
    displayed_caller_id: 'retell_agent',
  },
};

const mergeConfig = (agent) => ({
  ...defaultConfig,
  ...(agent?.language_config?.admin_config || {}),
  system_prompts: {
    ...defaultConfig.system_prompts,
    ...(agent?.language_config?.admin_config?.system_prompts || {}),
    ...(agent?.system_prompt ? { text_chat: agent.system_prompt } : {}),
  },
  transfer_call: {
    ...defaultConfig.transfer_call,
    ...(agent?.language_config?.admin_config?.transfer_call || {}),
  },
});

const Section = ({ icon: Icon, title, badge, children, defaultOpen = true, accent = 'blue' }) => {
  const [open, setOpen] = useState(defaultOpen);
  const color =
    accent === 'green'
      ? 'bg-emerald-500'
      : accent === 'orange'
        ? 'bg-orange-500'
        : accent === 'violet'
          ? 'bg-violet-500'
          : 'bg-blue-600';
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-100"
      >
        <span className="flex items-center gap-3">
          <span className={`w-9 h-9 rounded-lg ${color} text-white flex items-center justify-center`}>
            <Icon className="w-5 h-5" />
          </span>
          <span className="font-semibold text-slate-900">{title}</span>
          {badge && (
            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-medium">
              {badge}
            </span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-500 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="p-5 bg-slate-50/50">{children}</div>}
    </section>
  );
};

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`w-8 h-5 rounded-full p-0.5 flex items-center ${checked ? 'bg-slate-950 justify-end' : 'bg-slate-200 justify-start'}`}
  >
    <span className="w-4 h-4 rounded-full bg-white shadow-sm" />
  </button>
);

const RadioCard = ({ checked, onClick, icon: Icon, iconClass = 'bg-blue-400', title, description }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center justify-between gap-3 px-3 py-3 border border-slate-200 rounded-lg bg-white text-left hover:border-blue-300"
  >
    <span className="flex items-center gap-3 min-w-0">
      {Icon && (
        <span className={`w-7 h-7 rounded-full ${iconClass} text-white flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-4 h-4" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-sm text-slate-700 truncate">{title}</span>
        {description && <span className="block text-xs text-slate-500 truncate">{description}</span>}
      </span>
    </span>
    <span className={`w-4 h-4 rounded-full border flex-shrink-0 ${checked ? 'border-slate-950 ring-4 ring-slate-950/10 bg-slate-950' : 'border-slate-400 bg-white'}`} />
  </button>
);

const TransferCallModal = ({ value, onChange, onClose }) => {
  const update = (patch) => onChange({ ...value, ...patch });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/30 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[92vh] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <PhoneForwarded className="w-6 h-6 text-slate-600" />
            <h2 className="font-semibold text-slate-950">Transfer Call</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100" aria-label="Close transfer settings">
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-900">Name</span>
            <input
              value={value.name}
              onChange={(e) => update({ name: e.target.value })}
              className="mt-2 w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-900">Description <span className="text-slate-500 font-normal">(Optional)</span></span>
            <textarea
              value={value.description}
              onChange={(e) => update({ description: e.target.value })}
              rows={3}
              className="mt-2 w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-y"
            />
          </label>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <span className="text-sm font-medium text-slate-900">Transfer to</span>
              <button className="inline-flex items-center gap-1 text-sm text-slate-600">
                Format to E.164 <ChevronDown className="w-4 h-4" />
              </button>
            </div>
            <div className="inline-flex rounded-lg bg-slate-100 p-1 mb-2">
              {[
                ['static', 'Static Destination'],
                ['dynamic', 'Dynamic Routing'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => update({ routing_mode: key })}
                  className={`px-3 py-1.5 text-xs rounded-md ${value.routing_mode === key ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              value={value.destination_prompt}
              onChange={(e) => update({ destination_prompt: e.target.value })}
              rows={3}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-y"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-900">How should the AI handle the transfer?</p>
            <RadioCard
              checked={value.transfer_type === 'cold'}
              onClick={() => update({ transfer_type: 'cold' })}
              icon={PhoneForwarded}
              title="Cold Transfer"
              description="AI transfers immediately"
            />
            <RadioCard
              checked={value.transfer_type === 'warm'}
              onClick={() => update({ transfer_type: 'warm' })}
              icon={Bot}
              iconClass="bg-orange-400"
              title="Warm Transfer"
              description="AI gives a one-way brief to the agent"
            />
            <RadioCard
              checked={value.transfer_type === 'agentic_warm'}
              onClick={() => update({ transfer_type: 'agentic_warm' })}
              icon={Sparkles}
              iconClass="bg-violet-500"
              title="Agentic Warm Transfer"
              description="AI has a two-way conversation with agent, then bridges"
            />
          </div>

          <div className="border-t border-dashed border-slate-200 pt-4 space-y-5">
            <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-4">
              <div className="flex items-center gap-2 font-medium text-sm text-slate-900">
                <Music className="w-5 h-5 p-1 rounded-md bg-violet-100 text-violet-600" />
                During Transfer Call
              </div>
              <label className="block">
                <span className="text-sm text-slate-900">On-hold Music</span>
                <select
                  value={value.on_hold_music}
                  onChange={(e) => update({ on_hold_music: e.target.value })}
                  className="mt-2 w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-white"
                >
                  <option>Ringtone</option>
                  <option>Soft Tone</option>
                  <option>None</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm text-slate-900">Transfer Ring Duration</span>
                <div className="flex items-center gap-4 mt-2">
                  <input
                    type="range"
                    min="5"
                    max="90"
                    value={value.ring_duration_seconds}
                    onChange={(e) => update({ ring_duration_seconds: Number(e.target.value) })}
                    className="flex-1 accent-slate-950"
                  />
                  <span className="w-10 text-sm text-slate-900">{value.ring_duration_seconds}s</span>
                </div>
              </label>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-900">Navigate IVR</span>
                <Toggle checked={value.navigate_ivr} onChange={(navigate_ivr) => update({ navigate_ivr })} />
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-4">
              <div className="flex items-center gap-2 font-medium text-sm text-slate-900">
                <Bot className="w-5 h-5 p-1 rounded-md bg-emerald-100 text-emerald-600" />
                During Agent Connection
              </div>
              <p className="text-sm text-slate-900">Is there any internal queue or hold system before an agent answers?</p>
              <div className="grid grid-cols-2 gap-3">
                <RadioCard checked={value.internal_queue} onClick={() => update({ internal_queue: true })} title="Yes" />
                <RadioCard checked={!value.internal_queue} onClick={() => update({ internal_queue: false })} title="No" />
              </div>
              {value.internal_queue && (
                <div className="bg-slate-100 rounded-lg p-4">
                  <p className="text-sm text-slate-600 mb-3">Retell agent waits until a real person starts speaking before debriefing.</p>
                  <span className="text-sm font-medium text-slate-900">Wait Time for Agent Answer</span>
                  <div className="flex items-center gap-4 mt-2">
                    <input
                      type="range"
                      min="5"
                      max="90"
                      value={value.agent_wait_seconds}
                      onChange={(e) => update({ agent_wait_seconds: Number(e.target.value) })}
                      className="flex-1 accent-slate-950"
                    />
                    <span className="w-10 text-sm text-slate-900">{value.agent_wait_seconds}s</span>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-900">Whisper Debrief Message</p>
                  <p className="text-xs text-slate-500">Spoken only to the transfer agent.</p>
                </div>
                <Toggle checked={value.whisper_debrief} onChange={(whisper_debrief) => update({ whisper_debrief })} />
              </div>
            </div>

            <div className="border border-slate-200 rounded-lg bg-white p-4 space-y-4">
              <div className="flex items-center gap-2 font-medium text-sm text-slate-900">
                <PhoneForwarded className="w-5 h-5 p-1 rounded-md bg-blue-100 text-blue-600" />
                After Transfer Connects
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-900">
                <input
                  type="checkbox"
                  checked={value.three_way_ring_tone}
                  onChange={(e) => update({ three_way_ring_tone: e.target.checked })}
                  className="rounded bg-slate-950"
                />
                Three-Way Ring Tone
              </label>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-900">Three-Way Debrief Message</p>
                  <p className="text-xs text-slate-500">Enable public handoff message, both parties can hear.</p>
                </div>
                <Toggle checked={value.three_way_debrief} onChange={(three_way_debrief) => update({ three_way_debrief })} />
              </div>
              {value.three_way_debrief && (
                <div className="bg-slate-100 rounded-lg p-4">
                  <p className="text-sm font-medium text-slate-900 mb-2">Handoff Message</p>
                  <div className="inline-flex rounded-lg bg-slate-200 p-1 mb-2">
                    {[
                      ['prompt', 'Prompt'],
                      ['static', 'Static Sentence'],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => update({ handoff_mode: key })}
                        className={`px-3 py-1.5 text-xs rounded-md ${value.handoff_mode === key ? 'bg-white shadow-sm' : 'text-slate-500'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    value={value.handoff_message}
                    onChange={(e) => update({ handoff_message: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm resize-y bg-white"
                  />
                </div>
              )}
            </div>

            <div>
              <p className="text-sm font-medium text-slate-900 mb-2">Displayed Caller ID</p>
              <div className="grid grid-cols-2 gap-3">
                <RadioCard
                  checked={value.displayed_caller_id === 'retell_agent'}
                  onClick={() => update({ displayed_caller_id: 'retell_agent' })}
                  title="Retell Agent's Number"
                />
                <RadioCard
                  checked={value.displayed_caller_id === 'user'}
                  onClick={() => update({ displayed_caller_id: 'user' })}
                  title="User's Number"
                />
              </div>
            </div>
          </div>
        </div>

        <footer className="flex justify-end gap-3 px-5 py-4 border-t border-slate-200 bg-white">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium">
            Cancel
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg bg-slate-950 text-white text-sm font-medium">
            Update
          </button>
        </footer>
      </div>
    </div>
  );
};

const VoiceAgentConfiguration = ({ agent, onBack, onSaved }) => {
  const initialConfig = useMemo(() => mergeConfig(agent), [agent]);
  const [config, setConfig] = useState(initialConfig);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [voiceFilter, setVoiceFilter] = useState('All');

  const voiceTags = ['All', 'Upbeat', 'Bright', 'Clear', 'Calm', 'Distinct'];
  const filteredVoices = VOICES.filter((voice) => voiceFilter === 'All' || voice.tag === voiceFilter);
  const selectedVoice = VOICES.find((voice) => voice.name === config.voice) || VOICES[0];

  const updateConfig = (patch) => setConfig((prev) => ({ ...prev, ...patch }));
  const updatePrompts = (patch) =>
    setConfig((prev) => ({ ...prev, system_prompts: { ...prev.system_prompts, ...patch } }));

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setError(null);
    getVoiceAgentConfiguration(agent.id)
      .then((data) => {
        if (!ignore && data.config) {
          setConfig({
            ...defaultConfig,
            ...data.config,
            system_prompts: {
              ...defaultConfig.system_prompts,
              ...(data.config.system_prompts || {}),
            },
            transfer_call: {
              ...defaultConfig.transfer_call,
              ...(data.config.transfer_call || {}),
            },
          });
        }
      })
      .catch((err) => {
        if (!ignore) setError(err.message);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [agent.id]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await updateVoiceAgentConfiguration(agent.id, config);
      onSaved?.(data.agent);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-600 hover:bg-slate-50"
            aria-label="Back to agents"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-slate-950">{agent.display_name || agent.name}</h2>
            <p className="text-sm text-slate-500 font-mono">{agent.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTransferOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <PhoneForwarded className="w-4 h-4" />
            Transfer Call
          </button>
          <button
            onClick={() =>
              setConfig({
                ...defaultConfig,
                system_prompts: { ...defaultConfig.system_prompts },
                transfer_call: { ...defaultConfig.transfer_call },
              })
            }
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {loading && <div className="px-4 py-3 rounded-lg bg-blue-50 border border-blue-100 text-sm text-blue-700">Loading agent configuration...</div>}
      {error && <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">{error}</div>}

      <Section icon={Volume2} title="Voice Selection" badge={selectedVoice.name} accent="violet">
        <div className="flex flex-wrap gap-2 mb-4">
          {voiceTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setVoiceFilter(tag)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border ${
                voiceFilter === tag
                  ? 'bg-indigo-600 border-indigo-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
        <div className="max-h-72 overflow-y-auto pr-2 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          {filteredVoices.map((voice) => (
            <button
              key={voice.name}
              onClick={() => updateConfig({ voice: voice.name, voice_tag: voice.tag })}
              className={`h-24 rounded-xl border bg-white flex flex-col items-center justify-center gap-2 ${
                config.voice === voice.name ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center">
                <Mic className="w-4 h-4" />
              </span>
              <span className="text-sm font-semibold text-slate-700">{voice.name}</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-[11px] font-medium text-slate-600">
                {voice.tag}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section icon={MessageSquare} title="System Prompts" accent="green">
        <div className="space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Audio / Live Model System Prompt</span>
            <span className="block text-xs text-slate-400 mt-1">Injected before every live audio session</span>
            <textarea
              value={config.system_prompts.audio_live}
              onChange={(e) => updatePrompts({ audio_live: e.target.value })}
              rows={4}
              className="mt-2 w-full px-3 py-3 rounded-lg border border-slate-200 bg-white font-mono text-sm resize-y"
            />
          </label>
        </div>
      </Section>

      <Section icon={BarChart3} title="Active Configuration Summary" accent="orange">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {[
            ['Live Model', config.live_model],
            ['Voice', config.voice],
            ['Voice Style', selectedVoice.tag],
            ['Transfer', config.transfer_call.transfer_type],
          ].map(([label, value]) => (
            <div key={label} className="bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-sm font-semibold text-slate-950 mt-1">{value}</p>
            </div>
          ))}
        </div>
      </Section>

      {transferOpen && (
        <TransferCallModal
          value={config.transfer_call}
          onChange={(transfer_call) => updateConfig({ transfer_call })}
          onClose={() => setTransferOpen(false)}
        />
      )}
    </div>
  );
};

export default VoiceAgentConfiguration;
*/
