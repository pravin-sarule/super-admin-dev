import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronDown,
  ChevronUp,
  Settings2,
  Save,
  Maximize2,
} from 'lucide-react';
import { API_BASE_URL } from '../../../config';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const THINKING_LEVEL_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const defaultParams = {
  temperature: 1,
  media_resolution: 'default',
  thinking_mode: false,
  thinking_budget: false,
  thinking_level: 'default',
  structured_outputs_enabled: false,
  structured_outputs_config: {},
  code_execution: false,
  function_calling_enabled: false,
  function_calling_config: {},
  grounding_google_search: false,
  url_context: false,
  system_instructions: '',
  api_key_status: 'none',
};

function normalizeParams(raw) {
  if (!raw || typeof raw !== 'object') return { ...defaultParams };
  return {
    temperature: typeof raw.temperature === 'number' ? raw.temperature : (defaultParams.temperature),
    media_resolution: raw.media_resolution ?? defaultParams.media_resolution,
    thinking_mode: !!raw.thinking_mode,
    thinking_budget: !!raw.thinking_budget,
    thinking_level: raw.thinking_level ?? defaultParams.thinking_level,
    structured_outputs_enabled: !!raw.structured_outputs_enabled,
    structured_outputs_config: raw.structured_outputs_config && typeof raw.structured_outputs_config === 'object' ? raw.structured_outputs_config : {},
    code_execution: !!raw.code_execution,
    function_calling_enabled: !!raw.function_calling_enabled,
    function_calling_config: raw.function_calling_config && typeof raw.function_calling_config === 'object' ? raw.function_calling_config : {},
    grounding_google_search: !!raw.grounding_google_search,
    url_context: !!raw.url_context,
    system_instructions: typeof raw.system_instructions === 'string' ? raw.system_instructions : '',
    api_key_status: raw.api_key_status ?? defaultParams.api_key_status,
  };
}

const EditConfigModal = ({ title, open, onClose, value, onSave }) => {
  const [text, setText] = useState('');
  useEffect(() => {
    setText(typeof value === 'string' ? value : JSON.stringify(value || {}, null, 2));
  }, [open, value]);

  const handleSave = () => {
    try {
      const parsed = text.trim() ? JSON.parse(text) : {};
      onSave(parsed);
      onClose();
    } catch (e) {
      alert('Invalid JSON. Please fix and try again.');
    }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 flex-1 overflow-hidden">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-48 p-3 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder='{"key": "value"}'
            spellCheck={false}
          />
        </div>
        <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50">Cancel</button>
          <button type="button" onClick={handleSave} className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700">Save</button>
        </div>
      </div>
    </div>
  );
};

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => !disabled && onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
      checked ? 'bg-gray-900' : 'bg-gray-200'
    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
  </button>
);

function getModelNames(modelIds, llmModels) {
  if (!Array.isArray(modelIds) || modelIds.length === 0) return '—';
  const names = (modelIds || [])
    .map((id) => {
      const m = (llmModels || []).find((x) => x.id === id || x.id === Number(id));
      return m ? m.name : `ID ${id}`;
    })
    .filter(Boolean);
  return names.length ? names.join(', ') : '—';
}

export default function AgentParameterDrawer({ open, onClose, agent, llmModels, onSaved, api }) {
  const [params, setParams] = useState(defaultParams);
  const [promptText, setPromptText] = useState('');
  const [saving, setSaving] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const [structuredModalOpen, setStructuredModalOpen] = useState(false);
  const [promptEnlargeOpen, setPromptEnlargeOpen] = useState(false);
  const [promptEnlargeValue, setPromptEnlargeValue] = useState('');

  const agentId = agent?.id;
  const agentName = agent?.name || 'Agent';

  useEffect(() => {
    if (!open || !agent) return;
    const raw = agent.llm_parameters;
    const parsed = typeof raw === 'string' ? (() => { try { return JSON.parse(raw || '{}'); } catch { return {}; } })() : (raw || {});
    setParams(normalizeParams(parsed));
    setPromptText(agent.prompt || '');
  }, [open, agent]);

  const update = (key, value) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!agentId || !api) return;
    if (!promptText.trim()) {
      alert('Prompt is required.');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/agent-prompts/${agentId}`, {
        prompt: promptText.trim(),
        llm_parameters: params,
      });
      onSaved?.();
      onClose();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Failed to save parameters.');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col"
        style={{ animation: 'slideInRight 0.3s ease-out' }}
      >
        <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>

        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80">
          <div className="flex items-center gap-3">
            <Settings2 className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">LLM parameter configuration</h2>
              <p className="text-sm text-gray-500">{agentName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">{agentName}</h3>
            <p className="text-sm text-gray-600 mt-2">Configure prompt and generation settings for this agent.</p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <label className="block text-sm font-semibold text-gray-900 mb-2">Use model</label>
            <p className="text-sm text-gray-700">
              {getModelNames(agent?.model_ids, llmModels)}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              The LLM model used for this agent. Change it from the list by editing the agent.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-gray-900">Prompt</label>
              <button
                type="button"
                onClick={() => {
                  setPromptEnlargeValue(promptText);
                  setPromptEnlargeOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition"
              >
                <Maximize2 className="w-4 h-4" />
                Enlarge
              </button>
            </div>
            <textarea
              rows={10}
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter the main instruction this agent should follow..."
            />
            <p className="mt-2 text-xs text-gray-500">
              This is the core instruction used when generating responses. Changes here will update the agent prompt.
            </p>
          </div>
          {promptEnlargeOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => setPromptEnlargeOpen(false)}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Prompt — enlarged</h3>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPromptEnlargeOpen(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button type="button" onClick={() => { setPromptText(promptEnlargeValue); setPromptEnlargeOpen(false); }} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Done</button>
                  </div>
                </div>
                <div className="p-5 flex-1 min-h-0">
                  <textarea
                    rows={24}
                    value={promptEnlargeValue}
                    onChange={(e) => setPromptEnlargeValue(e.target.value)}
                    className="w-full h-full min-h-[60vh] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter the main instruction this agent should follow..."
                  />
                </div>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <label className="block text-sm font-semibold text-gray-900 mb-3">Temperature</label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={params.temperature}
                onChange={(e) => update('temperature', parseFloat(e.target.value))}
                className="flex-1 h-2 rounded-full appearance-none bg-gray-200 accent-blue-600"
              />
              <input
                type="number"
                min="0"
                max="2"
                step="0.1"
                value={params.temperature}
                onChange={(e) => update('temperature', Math.min(2, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center"
              />
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Thinking</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Thinking mode</span>
                <Toggle checked={params.thinking_mode} onChange={(v) => update('thinking_mode', v)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Set thinking budget</span>
                <Toggle checked={params.thinking_budget} onChange={(v) => update('thinking_budget', v)} />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Thinking level</label>
                <select
                  value={params.thinking_level}
                  onChange={(e) => update('thinking_level', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  {THINKING_LEVEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
            <button
              type="button"
              onClick={() => setToolsExpanded(!toolsExpanded)}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-gray-50"
            >
              <span className="text-sm font-semibold text-gray-900">Tools</span>
              {toolsExpanded ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
            </button>
            {toolsExpanded && (
              <div className="px-4 pb-4 space-y-4 border-t border-gray-100">
                <div className="flex items-center justify-between pt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-700">Structured outputs</span>
                    <button type="button" onClick={() => setStructuredModalOpen(true)} className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50">Edit</button>
                  </div>
                  <Toggle checked={params.structured_outputs_enabled} onChange={(v) => update('structured_outputs_enabled', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Code execution</span>
                  <Toggle checked={params.code_execution} onChange={(v) => update('code_execution', v)} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Grounding with Google Search</span>
                  <Toggle checked={params.grounding_google_search} onChange={(v) => update('grounding_google_search', v)} />
                </div>
                <p className="text-xs text-gray-500">Source: Google Search</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">URL context</span>
                  <Toggle checked={params.url_context} onChange={(v) => update('url_context', v)} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100">Cancel</button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save parameters'}
          </button>
        </div>
      </div>

      <EditConfigModal title="Structured outputs" open={structuredModalOpen} onClose={() => setStructuredModalOpen(false)} value={params.structured_outputs_config} onSave={(v) => update('structured_outputs_config', v)} />
    </>
  );
}
