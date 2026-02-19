import React, { useState, useEffect } from 'react';
import {
  Eye,
  Trash2,
  PlusCircle,
  Pencil,
  X,
  FileText,
  Settings2,
  ChevronDown,
  ChevronUp,
  Maximize2,
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { API_BASE_URL } from '../../../config';
import AgentParameterDrawer from './AgentParameterDrawer';

const MySwal = withReactContent(Swal);

const AGENT_PROMPTS_API = `${API_BASE_URL}/agent-prompts`;
const LLM_API = `${API_BASE_URL}/llm`;

// Same as Prompt Management: read token at request time from localStorage then sessionStorage
const getToken = () => {
  const t = localStorage.getItem('token') || sessionStorage.getItem('token');
  return t && typeof t === 'string' ? t.trim() : null;
};

const getHeaders = () => {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

// Axios instance that always attaches auth header from storage (same pattern as Prompt Management)
const api = axios.create({ baseURL: API_BASE_URL });
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (!config.headers['Content-Type']) config.headers['Content-Type'] = 'application/json';
  return config;
});
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// --- LLM parameter defaults (single source; no duplicate temperature in form) ---
const DEFAULT_LLM_PARAMS = {
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

const THINKING_LEVEL_OPTIONS = [
  { value: 'default', label: 'Default' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

function normalizeLlmParams(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_LLM_PARAMS };
  const p = typeof raw === 'string' ? (() => { try { return JSON.parse(raw || '{}'); } catch { return {}; } })() : raw;
  return {
    temperature: typeof p.temperature === 'number' ? p.temperature : DEFAULT_LLM_PARAMS.temperature,
    media_resolution: p.media_resolution ?? DEFAULT_LLM_PARAMS.media_resolution,
    thinking_mode: !!p.thinking_mode,
    thinking_budget: !!p.thinking_budget,
    thinking_level: p.thinking_level ?? DEFAULT_LLM_PARAMS.thinking_level,
    structured_outputs_enabled: !!p.structured_outputs_enabled,
    structured_outputs_config: p.structured_outputs_config && typeof p.structured_outputs_config === 'object' ? p.structured_outputs_config : {},
    code_execution: !!p.code_execution,
    function_calling_enabled: !!p.function_calling_enabled,
    function_calling_config: p.function_calling_config && typeof p.function_calling_config === 'object' ? p.function_calling_config : {},
    grounding_google_search: !!p.grounding_google_search,
    url_context: !!p.url_context,
    system_instructions: typeof p.system_instructions === 'string' ? p.system_instructions : '',
    api_key_status: p.api_key_status ?? DEFAULT_LLM_PARAMS.api_key_status,
  };
}

const ParamToggle = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${checked ? 'bg-blue-600' : 'bg-gray-200'} cursor-pointer`}
  >
    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
  </button>
);

// Inline LLM parameter configuration (used in create/edit form; no API key, system instruction, media resolution, function calling)
const LLMParameterFields = ({ params, onParamsChange }) => {
  const [toolsExpanded, setToolsExpanded] = useState(true);
  const update = (key, value) => onParamsChange({ ...params, [key]: value });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <label className="block text-sm font-semibold text-slate-800 mb-2">Temperature</label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={params.temperature ?? 1}
            onChange={(e) => update('temperature', parseFloat(e.target.value))}
            className="flex-1 h-2 rounded-full appearance-none bg-slate-200 accent-blue-600"
          />
          <input
            type="number"
            min="0"
            max="2"
            step="0.1"
            value={params.temperature ?? 1}
            onChange={(e) => update('temperature', Math.min(2, Math.max(0, parseFloat(e.target.value) || 0)))}
            className="w-14 px-2 py-1.5 border border-slate-200 rounded-lg text-sm text-center bg-white"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-800 mb-3">Thinking</h4>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Thinking mode</span>
            <ParamToggle checked={!!params.thinking_mode} onChange={(v) => update('thinking_mode', v)} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-700">Set thinking budget</span>
            <ParamToggle checked={!!params.thinking_budget} onChange={(v) => update('thinking_budget', v)} />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Thinking level</label>
            <select
              value={params.thinking_level || 'default'}
              onChange={(e) => update('thinking_level', e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            >
              {THINKING_LEVEL_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setToolsExpanded(!toolsExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-50"
        >
          <span className="text-sm font-semibold text-slate-800">Tools</span>
          {toolsExpanded ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
        </button>
        {toolsExpanded && (
          <div className="px-4 pb-4 space-y-3 border-t border-slate-100">
            <div className="flex items-center justify-between pt-3">
              <span className="text-sm text-slate-700">Structured outputs</span>
              <ParamToggle checked={!!params.structured_outputs_enabled} onChange={(v) => update('structured_outputs_enabled', v)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Code execution</span>
              <ParamToggle checked={!!params.code_execution} onChange={(v) => update('code_execution', v)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">Grounding with Google Search</span>
              <ParamToggle checked={!!params.grounding_google_search} onChange={(v) => update('grounding_google_search', v)} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-700">URL context</span>
              <ParamToggle checked={!!params.url_context} onChange={(v) => update('url_context', v)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// --- Agent table for one tab ---
const AgentTable = ({ agents, llmModels, onView, onDelete, onConfigureParams, loading }) => {
  const getModelNames = (modelIds) => {
    if (!Array.isArray(modelIds) || modelIds.length === 0) return '—';
    const names = (modelIds || [])
      .map((id) => {
        const m = llmModels.find((x) => x.id === id || x.id === Number(id));
        return m ? m.name : `ID ${id}`;
      })
      .filter(Boolean);
    return names.length ? names.join(', ') : '—';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!agents.length) {
    return (
      <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-slate-100">
        <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
        <p className="font-medium">No agents yet</p>
        <p className="text-sm">Create an agent to get started.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Type
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Models
            </th>
            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Temperature
            </th>
            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {agents.map((agent) => (
            <tr key={agent.id} className="hover:bg-slate-50/50">
              <td className="px-6 py-4">
                <span className="font-medium text-slate-900">{agent.name}</span>
              </td>
              <td className="px-6 py-4">
                <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 capitalize">
                  {agent.agent_type || '—'}
                </span>
              </td>
              <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate">
                {getModelNames(agent.model_ids)}
              </td>
              <td className="px-6 py-4 text-sm text-slate-600">
                {Number(agent.temperature) ?? '—'}
              </td>
              <td className="px-6 py-4 text-right">
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    title="Configure parameters"
                    onClick={() => onConfigureParams(agent)}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    <Settings2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="View"
                    onClick={() => onView(agent)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => onDelete(agent)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// --- Create / Edit agent form (used in modal and in view detail) ---
const AgentForm = ({
  form,
  setForm,
  llmModels,
  agentType,
  onSubmit,
  onCancel,
  submitLabel,
  loading,
}) => {
  const [paramsSectionOpen, setParamsSectionOpen] = useState(true);
  const [promptEnlargeOpen, setPromptEnlargeOpen] = useState(false);
  const [promptEnlargeValue, setPromptEnlargeValue] = useState('');
  const selectedModelId = Array.isArray(form.model_ids) && form.model_ids.length > 0 ? form.model_ids[0] : '';

  const llmParams = form.llm_parameters && typeof form.llm_parameters === 'object' ? form.llm_parameters : { ...DEFAULT_LLM_PARAMS };

  return (
    <div className="space-y-6">
      {/* Basic details — professional card */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-l-4 border-blue-600 bg-blue-50/50 px-4 py-2.5">
          <h3 className="text-sm font-semibold text-slate-800">Basic details</h3>
          <p className="text-xs text-slate-500">Name, prompt and model</p>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
            <input
              type="text"
              value={form.name || ''}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Agent name"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-700">Prompt</label>
              <button
                type="button"
                onClick={() => {
                  setPromptEnlargeValue(form.prompt || '');
                  setPromptEnlargeOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition"
              >
                <Maximize2 className="w-4 h-4" />
                Enlarge
              </button>
            </div>
            <textarea
              value={form.prompt || ''}
              onChange={(e) => setForm((p) => ({ ...p, prompt: e.target.value }))}
              rows={10}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter the prompt for this agent..."
            />
          </div>
          {promptEnlargeOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => setPromptEnlargeOpen(false)}>
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-900">Prompt — enlarged</h3>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setPromptEnlargeOpen(false)} className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
                    <button type="button" onClick={() => { setForm((p) => ({ ...p, prompt: promptEnlargeValue })); setPromptEnlargeOpen(false); }} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Done</button>
                  </div>
                </div>
                <div className="p-5 flex-1 min-h-0">
                  <textarea
                    rows={24}
                    value={promptEnlargeValue}
                    onChange={(e) => setPromptEnlargeValue(e.target.value)}
                    className="w-full h-full min-h-[60vh] px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter the prompt for this agent..."
                  />
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Model</label>
            <select
              value={selectedModelId}
              onChange={(e) => {
                const val = e.target.value;
                setForm((p) => ({ ...p, model_ids: val ? [Number(val)] : [] }));
              }}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              <option value="">Select a model</option>
              {(llmModels || []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            {(!llmModels || !llmModels.length) && (
              <p className="text-sm text-slate-500 mt-1">No models available. Add models in LLM Management.</p>
            )}
          </div>
        </div>
      </div>

      {/* LLM parameter configuration — single place for temperature & tools; no duplicate */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setParamsSectionOpen(!paramsSectionOpen)}
          className="w-full border-l-4 border-blue-600 bg-blue-50/50 px-4 py-2.5 flex items-center justify-between text-left hover:bg-blue-50/70"
        >
          <div>
            <h3 className="text-sm font-semibold text-slate-800">Configure parameters</h3>
            <p className="text-xs text-slate-500">Temperature, thinking, tools & system instructions</p>
          </div>
          {paramsSectionOpen ? <ChevronUp className="w-5 h-5 text-slate-500" /> : <ChevronDown className="w-5 h-5 text-slate-500" />}
        </button>
        {paramsSectionOpen && (
          <div className="p-4 border-t border-slate-100">
            <LLMParameterFields
              params={llmParams}
              onParamsChange={(p) => setForm((prev) => ({ ...prev, llm_parameters: p }))}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg font-medium"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {loading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </div>
  );
};

// --- View detail modal (read-only with Edit toggle) ---
const ViewAgentModal = ({
  agent,
  llmModels,
  onClose,
  onUpdated,
  onDeleted,
  onConfigureParams,
}) => {
  const [editMode, setEditMode] = useState(false);
  const [edited, setEdited] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewPromptEnlargeOpen, setViewPromptEnlargeOpen] = useState(false);

  const modelNames = (agent?.model_ids || [])
    .map((id) => {
      const m = (llmModels || []).find((x) => x.id === id || x.id === Number(id));
      return m ? m.name : `ID ${id}`;
    })
    .filter(Boolean);

  const handleUpdate = async () => {
    if (!edited || !agent?.id) return;
    if (!edited.name?.trim() || !edited.prompt?.trim()) {
      MySwal.fire({
        icon: 'warning',
        title: 'Validation',
        text: 'Name and Prompt are required.',
        confirmButtonColor: '#3085d6',
      });
      return;
    }
    setLoading(true);
    try {
      const params = edited.llm_parameters && typeof edited.llm_parameters === 'object' ? edited.llm_parameters : normalizeLlmParams(agent.llm_parameters);
      await api.put(`/agent-prompts/${agent.id}`, {
        name: edited.name.trim(),
        prompt: edited.prompt.trim(),
        model_ids: Array.isArray(edited.model_ids) ? edited.model_ids : [],
        temperature: Number(params.temperature) ?? 0.7,
        agent_type: edited.agent_type || agent.agent_type,
        llm_parameters: params,
      });
      MySwal.fire({
        icon: 'success',
        title: 'Updated',
        text: 'Agent prompt updated successfully.',
        confirmButtonColor: '#3085d6',
        timer: 2000,
      });
      setEditMode(false);
      setEdited(null);
      onUpdated?.();
    } catch (err) {
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || 'Failed to update agent.',
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const result = await MySwal.fire({
      title: 'Delete this agent?',
      text: "You won't be able to revert this.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it',
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/agent-prompts/${agent.id}`);
      MySwal.fire({
        icon: 'success',
        title: 'Deleted',
        text: 'Agent has been deleted.',
        confirmButtonColor: '#3085d6',
        timer: 2000,
      });
      onDeleted?.();
      onClose();
    } catch (err) {
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || 'Failed to delete agent.',
        confirmButtonColor: '#3085d6',
      });
    }
  };

  if (!agent) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">
              {editMode ? 'Edit Agent' : 'Agent Details'}
            </h2>
            <div className="flex items-center gap-2">
              {!editMode ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setEdited({
                        name: agent.name,
                        prompt: agent.prompt,
                        model_ids: agent.model_ids || [],
                        temperature: agent.temperature ?? 0.7,
                        agent_type: agent.agent_type,
                        llm_parameters: normalizeLlmParams(agent.llm_parameters),
                      });
                      setEditMode(true);
                    }}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Pencil className="w-4 h-4 mr-1" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditMode(false);
                    setEdited(null);
                  }}
                  className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
          <div className="px-6 py-4 overflow-y-auto flex-1">
            {editMode && edited ? (
              <AgentForm
                form={edited}
                setForm={setEdited}
                llmModels={llmModels}
                agentType={agent.agent_type}
                onSubmit={handleUpdate}
                onCancel={() => {
                  setEditMode(false);
                  setEdited(null);
                }}
                submitLabel="Update"
                loading={loading}
              />
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Name</p>
                  <p className="text-gray-900 font-medium">{agent.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Type</p>
                  <span className="inline-flex px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 capitalize">
                    {agent.agent_type || '—'}
                  </span>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-gray-500 uppercase">Prompt</p>
                    <button
                      type="button"
                      onClick={() => setViewPromptEnlargeOpen(true)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    >
                      <Maximize2 className="w-4 h-4" />
                      Enlarge
                    </button>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-700 whitespace-pre-wrap text-sm min-h-[8rem] max-h-[16rem] overflow-y-auto">
                    {agent.prompt || '—'}
                  </div>
                </div>
                {viewPromptEnlargeOpen && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={() => setViewPromptEnlargeOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-slate-900">Prompt — enlarged</h3>
                        <button type="button" onClick={() => setViewPromptEnlargeOpen(false)} className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Close</button>
                      </div>
                      <div className="p-5 flex-1 min-h-0 overflow-y-auto">
                        <pre className="w-full p-4 bg-slate-50 rounded-lg text-slate-700 whitespace-pre-wrap text-sm min-h-[60vh]">
                          {agent.prompt || '—'}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase mb-1">Models</p>
                  <p className="text-gray-700">{modelNames.length ? modelNames.join(', ') : '—'}</p>
                </div>
                {/* Temperature only in Saved parameters below */}
                {/* Saved LLM parameters (fetched with agent; show all saved) */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <p className="text-xs font-semibold text-slate-600 uppercase mb-3">Saved parameters</p>
                  {(() => {
                    const p = normalizeLlmParams(agent.llm_parameters);
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div><span className="text-slate-500">Temperature:</span> <span className="text-slate-800">{Number(p.temperature) ?? Number(agent.temperature) ?? '—'}</span></div>
                        <div><span className="text-slate-500">Thinking mode:</span> <span className="text-slate-800">{p.thinking_mode ? 'On' : 'Off'}</span></div>
                        <div><span className="text-slate-500">Thinking budget:</span> <span className="text-slate-800">{p.thinking_budget ? 'On' : 'Off'}</span></div>
                        <div><span className="text-slate-500">Thinking level:</span> <span className="text-slate-800">{p.thinking_level || '—'}</span></div>
                        <div><span className="text-slate-500">Structured outputs:</span> <span className="text-slate-800">{p.structured_outputs_enabled ? 'On' : 'Off'}</span></div>
                        <div><span className="text-slate-500">Code execution:</span> <span className="text-slate-800">{p.code_execution ? 'On' : 'Off'}</span></div>
                        <div><span className="text-slate-500">Grounding (Google):</span> <span className="text-slate-800">{p.grounding_google_search ? 'On' : 'Off'}</span></div>
                        <div><span className="text-slate-500">URL context:</span> <span className="text-slate-800">{p.url_context ? 'On' : 'Off'}</span></div>
                      </div>
                    );
                  })()}
                </div>
                <div className="pt-4 flex gap-2 flex-wrap">
                  {onConfigureParams && (
                    <button
                      type="button"
                      onClick={() => { onConfigureParams(agent); onClose(); }}
                      className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                    >
                      <Settings2 className="w-4 h-4 mr-2" />
                      Configure LLM parameters
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Agent
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main page ---
const AgentList = () => {
  const [activeTab, setActiveTab] = useState('drafting'); // first tab: Drafting Agents
  const [draftingAgents, setDraftingAgents] = useState([]);
  const [summarizationAgents, setSummarizationAgents] = useState([]);
  const [llmModels, setLlmModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewAgent, setViewAgent] = useState(null);
  const [parameterDrawerAgent, setParameterDrawerAgent] = useState(null);
  const [createForm, setCreateForm] = useState({
    name: '',
    prompt: '',
    model_ids: [],
    temperature: 0.7,
    agent_type: 'drafting',
  });
  const [createLoading, setCreateLoading] = useState(false);

  const fetchAgents = async () => {
    const token = getToken();
    if (!token) {
      setError('No authentication token found');
      return;
    }
    try {
      setError(null);
      const [draftRes, sumRes] = await Promise.all([
        api.get('/agent-prompts', { params: { agent_type: 'drafting' } }),
        api.get('/agent-prompts', { params: { agent_type: 'summarization' } }),
      ]);
      setDraftingAgents(draftRes.data?.data || []);
      setSummarizationAgents(sumRes.data?.data || []);
    } catch (err) {
      console.error('Error fetching agents:', err);
      setError(err.response?.data?.message || 'Failed to load agents.');
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || 'Failed to load agents.',
        confirmButtonColor: '#3085d6',
      });
    }
  };

  const fetchLlmModels = async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await api.get('/llm');
      setLlmModels(res.data || []);
    } catch (err) {
      console.error('Error fetching LLM models:', err);
    }
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setError('No authentication token found');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    Promise.all([fetchAgents(), fetchLlmModels()]).finally(() => setLoading(false));
  }, []);

  const currentAgents = activeTab === 'drafting' ? draftingAgents : summarizationAgents;
  const agentType = activeTab === 'drafting' ? 'drafting' : 'summarization';

  const openCreate = () => {
    setCreateForm({
      name: '',
      prompt: '',
      model_ids: [],
      agent_type: agentType,
      llm_parameters: { ...DEFAULT_LLM_PARAMS },
    });
    setShowCreateModal(true);
  };

  const handleCreate = async () => {
    if (!createForm.name?.trim() || !createForm.prompt?.trim()) {
      MySwal.fire({
        icon: 'warning',
        title: 'Validation',
        text: 'Name and Prompt are required.',
        confirmButtonColor: '#3085d6',
      });
      return;
    }
    setCreateLoading(true);
    try {
      const params = createForm.llm_parameters && typeof createForm.llm_parameters === 'object' ? createForm.llm_parameters : DEFAULT_LLM_PARAMS;
      await api.post('/agent-prompts', {
        name: createForm.name.trim(),
        prompt: createForm.prompt.trim(),
        model_ids: Array.isArray(createForm.model_ids) ? createForm.model_ids : [],
        temperature: Number(params.temperature) ?? 0.7,
        agent_type: createForm.agent_type,
        llm_parameters: params,
      });
      MySwal.fire({
        icon: 'success',
        title: 'Created',
        text: 'Agent prompt created successfully.',
        confirmButtonColor: '#3085d6',
        timer: 2000,
      });
      setShowCreateModal(false);
      fetchAgents();
    } catch (err) {
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || 'Failed to create agent.',
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleDelete = async (agent) => {
    const result = await MySwal.fire({
      title: 'Delete this agent?',
      text: "You won't be able to revert this.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it',
    });
    if (!result.isConfirmed) return;
    try {
      await api.delete(`/agent-prompts/${agent.id}`);
      MySwal.fire({
        icon: 'success',
        title: 'Deleted',
        text: 'Agent has been deleted.',
        confirmButtonColor: '#3085d6',
        timer: 2000,
      });
      fetchAgents();
      if (viewAgent?.id === agent.id) setViewAgent(null);
    } catch (err) {
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || 'Failed to delete agent.',
        confirmButtonColor: '#3085d6',
      });
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto min-h-screen bg-slate-50/50">
      <div className="mb-6">
        <div className="border-l-4 border-blue-600 pl-4">
          <h1 className="text-2xl font-bold text-slate-900">Agent Prompt Management</h1>
          <p className="text-slate-600 mt-1 text-sm">Create and manage drafting and summarization agents with prompts, models and LLM parameters.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5">
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
          <nav className="flex">
            <button
              type="button"
              onClick={() => setActiveTab('drafting')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'drafting'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Drafting Agents
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('summarization')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'summarization'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              Summarization Agents
            </button>
          </nav>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-sm"
        >
          <PlusCircle className="w-5 h-5 mr-2" />
          Create Agent
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <AgentTable
          agents={currentAgents}
          llmModels={llmModels}
          onView={setViewAgent}
          onDelete={handleDelete}
          onConfigureParams={setParameterDrawerAgent}
          loading={loading}
        />
        {!loading && (
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-sm text-slate-600">
            <span>
              Showing {currentAgents.length === 0 ? 0 : 1} to {currentAgents.length} of {currentAgents.length} results
            </span>
            {currentAgents.length > 0 && (
              <div className="flex items-center gap-1">
                <span className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-blue-600 text-white text-xs font-medium">1</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="fixed inset-0 bg-slate-900/50" onClick={() => setShowCreateModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/80">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Create Agent</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Add a new drafting or summarization agent</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="p-2 text-slate-500 hover:bg-slate-200 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-5 overflow-y-auto bg-slate-50/30">
                <AgentForm
                  form={createForm}
                  setForm={setCreateForm}
                  llmModels={llmModels}
                  agentType={agentType}
                  onSubmit={handleCreate}
                  onCancel={() => setShowCreateModal(false)}
                  submitLabel="Create Agent"
                  loading={createLoading}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View / Edit detail modal */}
      {viewAgent && (
        <ViewAgentModal
          agent={viewAgent}
          llmModels={llmModels}
          onClose={() => setViewAgent(null)}
          onUpdated={() => {
            fetchAgents();
            setViewAgent(null);
          }}
          onDeleted={() => {
            fetchAgents();
            setViewAgent(null);
          }}
          onConfigureParams={(agent) => {
            setParameterDrawerAgent(agent);
            setViewAgent(null);
          }}
        />
      )}

      {/* LLM parameter configuration drawer (same tab, slide-over) */}
      <AgentParameterDrawer
        open={!!parameterDrawerAgent}
        onClose={() => setParameterDrawerAgent(null)}
        agent={parameterDrawerAgent || undefined}
        llmModels={llmModels}
        onSaved={() => fetchAgents()}
        api={api}
      />
    </div>
  );
};

export default AgentList;
