import React, { useState, useEffect } from 'react';
import {
  X,
  ChevronDown,
  ChevronUp,
  Settings2,
  Save,
  Key,
  MessageSquare,
} from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
};

const MEDIA_RESOLUTION_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'low', label: 'Low' },
  { value: 'high', label: 'High' },
];

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

// Small modal for editing JSON/config (Structured outputs, Function calling)
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
  }

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
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

// Toggle switch component
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
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
        checked ? 'translate-x-5' : 'translate-x-1'
      }`}
    />
  </button>
);

export default function LLMParameterDrawer({ open, onClose, model, onSaved }) {
  const [params, setParams] = useState(defaultParams);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const [structuredModalOpen, setStructuredModalOpen] = useState(false);
  const [functionModalOpen, setFunctionModalOpen] = useState(false);

  const modelId = model?.id;
  const modelName = model?.name || 'LLM';

  useEffect(() => {
    if (!open || !modelId) return;
    setLoading(true);
    axios
      .get(`${API_BASE_URL}/llm/${modelId}/parameters`, { headers: getAuthHeaders() })
      .then((res) => {
        const d = res.data;
        setParams({
          temperature: d.temperature ?? defaultParams.temperature,
          media_resolution: d.media_resolution ?? defaultParams.media_resolution,
          thinking_mode: !!d.thinking_mode,
          thinking_budget: !!d.thinking_budget,
          thinking_level: d.thinking_level ?? defaultParams.thinking_level,
          structured_outputs_enabled: !!d.structured_outputs_enabled,
          structured_outputs_config: d.structured_outputs_config ?? {},
          code_execution: !!d.code_execution,
          function_calling_enabled: !!d.function_calling_enabled,
          function_calling_config: d.function_calling_config ?? {},
          grounding_google_search: !!d.grounding_google_search,
          url_context: !!d.url_context,
          system_instructions: d.system_instructions ?? '',
          api_key_status: d.api_key_status ?? defaultParams.api_key_status,
        });
      })
      .catch(() => setParams(defaultParams))
      .finally(() => setLoading(false));
  }, [open, modelId]);

  const update = (key, value) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!modelId) return;
    setSaving(true);
    try {
      await axios.put(
        `${API_BASE_URL}/llm/${modelId}/parameters`,
        {
          temperature: params.temperature,
          media_resolution: params.media_resolution,
          thinking_mode: params.thinking_mode,
          thinking_budget: params.thinking_budget,
          thinking_level: params.thinking_level,
          structured_outputs_enabled: params.structured_outputs_enabled,
          structured_outputs_config: params.structured_outputs_config,
          code_execution: params.code_execution,
          function_calling_enabled: params.function_calling_enabled,
          function_calling_config: params.function_calling_config,
          grounding_google_search: params.grounding_google_search,
          url_context: params.url_context,
          system_instructions: params.system_instructions,
          api_key_status: params.api_key_status,
        },
        { headers: getAuthHeaders() }
      );
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
        className="fixed top-0 right-0 bottom-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300"
        style={{ animation: 'slideInRight 0.3s ease-out' }}
      >
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80">
          <div className="flex items-center gap-3">
            <Settings2 className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">LLM parameter configuration</h2>
              <p className="text-sm text-gray-500">{modelName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* Model info card */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">{modelName}</h3>
                <p className="text-xs text-gray-500">{model?.name || '—'}</p>
                <p className="text-sm text-gray-600 mt-2">Configure generation and tool settings for this model.</p>
              </div>

              {/* System instructions */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-900">System instructions</h3>
                </div>
                <p className="text-xs text-gray-500 mb-2">Optional tone and style instructions for the model.</p>
                <textarea
                  value={params.system_instructions}
                  onChange={(e) => update('system_instructions', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="e.g. Be concise and professional..."
                />
              </div>

              {/* API Key status */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Key className="w-4 h-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-900">API Key</h3>
                </div>
                <p className="text-xs text-gray-500">Switch to a paid API key to unlock higher quota and more features.</p>
              </div>

              {/* Temperature */}
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

              {/* Media resolution */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <label className="block text-sm font-semibold text-gray-900 mb-2">Media resolution</label>
                <select
                  value={params.media_resolution}
                  onChange={(e) => update('media_resolution', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {MEDIA_RESOLUTION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Thinking */}
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

              {/* Tools (collapsible) */}
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
                        <button
                          type="button"
                          onClick={() => setStructuredModalOpen(true)}
                          className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                      </div>
                      <Toggle checked={params.structured_outputs_enabled} onChange={(v) => update('structured_outputs_enabled', v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">Code execution</span>
                      <Toggle checked={params.code_execution} onChange={(v) => update('code_execution', v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">Function calling</span>
                        <button
                          type="button"
                          onClick={() => setFunctionModalOpen(true)}
                          className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-600 hover:bg-blue-50"
                        >
                          Edit
                        </button>
                      </div>
                      <Toggle checked={params.function_calling_enabled} onChange={(v) => update('function_calling_enabled', v)} />
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
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save parameters'}
          </button>
        </div>
      </div>

      <EditConfigModal
        title="Structured outputs"
        open={structuredModalOpen}
        onClose={() => setStructuredModalOpen(false)}
        value={params.structured_outputs_config}
        onSave={(v) => update('structured_outputs_config', v)}
      />
      <EditConfigModal
        title="Function calling"
        open={functionModalOpen}
        onClose={() => setFunctionModalOpen(false)}
        value={params.function_calling_config}
        onSave={(v) => update('function_calling_config', v)}
      />
    </>
  );
}
