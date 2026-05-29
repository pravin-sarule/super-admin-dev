import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import {
  Bot, Database, Filter, RefreshCw, Save, MessageSquare, BookOpen,
  Cpu, Thermometer, Zap, BarChart2, Search,
  Hash, Layers, Plus, Edit2, X, Check, Trash2,
  Activity,
} from 'lucide-react';
import { API_BASE_URL } from '../../config';

const MySwal = withReactContent(Swal);

const decodeToken = (token) => {
  try {
    if (!token) return null;
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

const DEFAULT_CHAT_CONFIG = {
  max_output_tokens: 20000,
  total_tokens_per_day: 250000,
  llm_model: 'gemini-2.5-flash-lite',
  llm_provider: 'google',
  model_temperature: 0.7,
  messages_per_hour: 50,
  quota_chats_per_minute: 10,
  chats_per_day: 60,
  max_document_pages: 300,
  max_document_size_mb: 40,
  max_file_upload_per_day: 15,
  max_upload_files: 8,
  streaming_delay: 100,
};

const DEFAULT_SUMMARIZATION_CONFIG = {
  llm_model: 'gemini-2.5-flash',
  llm_provider: 'google',
  model_temperature: 0.7,
  max_output_tokens: 25000,
  streaming_delay: 50,
  max_upload_files: 10,
  max_file_size_mb: 100,
  max_document_size_mb: 40,
  max_document_pages: 400,
  max_context_documents: 8,
  embedding_provider: 'google',
  embedding_model: 'text-embedding-004',
  embedding_dimension: 768,
  retrieval_top_k: 10,
  use_hybrid_search: true,
  use_rrf: true,
  semantic_weight: 0.7,
  keyword_weight: 0.3,
  text_search_language: 'english',
  total_tokens_per_day: 300000,
  messages_per_hour: 60,
  quota_chats_per_minute: 20,
  chats_per_day: 80,
  max_file_upload_per_day: 15,
  max_conversation_history: 25,
};

/* ─────────────────────────── helpers ─────────────────────────── */

const FormField = ({ label, hint, icon: Icon, children, span2 = false }) => (
  <div className={span2 ? 'md:col-span-2' : ''}>
    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
      {Icon && <Icon size={12} className="text-slate-400" />}
      {label}
    </label>
    {children}
    {hint && <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{hint}</p>}
  </div>
);

const inputCls =
  'w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 placeholder-slate-400 shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 hover:border-slate-300';

const selectCls =
  'w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 shadow-sm transition-all duration-150 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 hover:border-slate-300';

const SectionCard = ({ icon: Icon, title, description, children }) => (
  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden w-full">
    <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-white border border-slate-200 text-blue-600">
        <Icon size={16} />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
    </div>
    <div className="p-5 md:p-6">{children}</div>
  </div>
);

const ToggleSwitch = ({ checked, onChange, label, description }) => (
  <div
    className="flex items-center justify-between p-4 bg-white rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:border-slate-300 transition-colors"
    onClick={() => onChange(!checked)}
    role="switch"
    aria-checked={checked}
  >
    <div>
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
    </div>
    <div className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${checked ? 'bg-blue-600' : 'bg-slate-200'}`}>
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
  </div>
);

/* ──────────────────────────── main component ──────────────────────────── */

const LLMManagement = () => {
  const [activeTab, setActiveTab] = useState('max-tokens');
  const [userInfo, setUserInfo] = useState(null);

  const [llmModels, setLlmModels] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [llmMaxTokens, setLlmMaxTokens] = useState([]);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [maxTokenEditForm, setMaxTokenEditForm] = useState({ provider: '', model_name: '', max_output_tokens: '' });
  const [maxTokenSavingId, setMaxTokenSavingId] = useState(null);
  const [isAddingNewEntry, setIsAddingNewEntry] = useState(false);
  const [newEntryForm, setNewEntryForm] = useState({ provider: '', model_name: '', max_output_tokens: '', model_id: '' });
  const [addingEntryLoading, setAddingEntryLoading] = useState(false);
  const [newLlmModelName, setNewLlmModelName] = useState('');
  const [addingLlmLoading, setAddingLlmLoading] = useState(false);
  const [llmModelDeletingId, setLlmModelDeletingId] = useState(null);
  const [maxTokenDeletingId, setMaxTokenDeletingId] = useState(null);

  const [chatConfig, setChatConfig] = useState(DEFAULT_CHAT_CONFIG);
  const [chatConfigOriginal, setChatConfigOriginal] = useState(DEFAULT_CHAT_CONFIG);
  const [chatConfigLoading, setChatConfigLoading] = useState(false);
  const [chatConfigSaving, setChatConfigSaving] = useState(false);

  const [sumConfig, setSumConfig] = useState(DEFAULT_SUMMARIZATION_CONFIG);
  const [sumConfigOriginal, setSumConfigOriginal] = useState(DEFAULT_SUMMARIZATION_CONFIG);
  const [sumConfigLoading, setSumConfigLoading] = useState(false);
  const [sumConfigSaving, setSumConfigSaving] = useState(false);

  const LLM_API_URL = `${API_BASE_URL}/llm`;
  const LLM_MAX_TOKENS_API_URL = `${API_BASE_URL}/llm/max-tokens`;
  const CHAT_CONFIG_API_URL = `${API_BASE_URL}/admin/llm-config`;
  const SUMMARIZATION_CONFIG_API_URL = `${API_BASE_URL}/admin/summarization-chat-config`;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      MySwal.fire({ icon: 'warning', title: 'Authentication Required', text: 'Please login to access this page.', confirmButtonColor: '#2563eb' });
      return;
    }
    const decoded = decodeToken(token);
    if (!decoded) {
      MySwal.fire({ icon: 'error', title: 'Authentication Error', text: 'Invalid token. Please login again.', confirmButtonColor: '#dc2626' });
      return;
    }
    setUserInfo({ name: decoded.name || decoded.username, role: decoded.role || decoded.userRole, email: decoded.email });
  }, []);

  useEffect(() => {
    if (!userInfo) return;
    const fetchData = async () => {
      await Promise.all([fetchLlmModels(), fetchLlmMaxTokens(), fetchChatConfig(), fetchSummarizationConfig()]);
      setLoading(false);
    };
    fetchData();
  }, [userInfo]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  };

  const fetchLlmModels = async () => {
    try {
      const response = await axios.get(LLM_API_URL, { headers: getAuthHeaders() });
      setLlmModels(response.data || []);
    } catch (error) {
      console.error('Error fetching LLM models:', error);
      MySwal.fire({ icon: 'error', title: 'Unable to load models', text: error.response?.data?.message || 'Please try again later.', confirmButtonColor: '#dc2626' });
    }
  };

  const fetchLlmMaxTokens = async () => {
    try {
      const response = await axios.get(LLM_MAX_TOKENS_API_URL, { headers: getAuthHeaders() });
      setLlmMaxTokens(response.data || []);
    } catch (error) {
      console.error('Error fetching LLM max token entries:', error);
    }
  };

  const fetchChatConfig = async () => {
    setChatConfigLoading(true);
    try {
      const response = await axios.get(CHAT_CONFIG_API_URL, { headers: getAuthHeaders() });
      const data = response.data || DEFAULT_CHAT_CONFIG;
      setChatConfig({ ...DEFAULT_CHAT_CONFIG, ...data });
      setChatConfigOriginal({ ...DEFAULT_CHAT_CONFIG, ...data });
    } catch (error) {
      console.error('Error fetching chat config:', error);
    } finally {
      setChatConfigLoading(false);
    }
  };

  const fetchSummarizationConfig = async () => {
    setSumConfigLoading(true);
    try {
      const response = await axios.get(SUMMARIZATION_CONFIG_API_URL, { headers: getAuthHeaders() });
      const data = response.data || DEFAULT_SUMMARIZATION_CONFIG;
      const merged = { ...DEFAULT_SUMMARIZATION_CONFIG, ...data };
      if (typeof merged.use_hybrid_search === 'string') merged.use_hybrid_search = merged.use_hybrid_search === 'true' || merged.use_hybrid_search === 't';
      if (typeof merged.use_rrf === 'string') merged.use_rrf = merged.use_rrf === 'true' || merged.use_rrf === 't';
      setSumConfig(merged);
      setSumConfigOriginal({ ...merged });
    } catch (error) {
      console.error('Error fetching summarization chat config:', error);
    } finally {
      setSumConfigLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchLlmModels(), fetchLlmMaxTokens(), fetchChatConfig(), fetchSummarizationConfig()]);
    setRefreshing(false);
  };

  const handleChatConfigChange = (field, value) => setChatConfig((prev) => ({ ...prev, [field]: value }));

  const handleSaveChatConfig = async () => {
    setChatConfigSaving(true);
    try {
      const payload = {
        max_output_tokens: parseInt(chatConfig.max_output_tokens, 10),
        total_tokens_per_day: parseInt(chatConfig.total_tokens_per_day, 10),
        llm_model: chatConfig.llm_model,
        llm_provider: String(chatConfig.llm_provider || 'google').trim(),
        model_temperature: parseFloat(chatConfig.model_temperature),
        messages_per_hour: parseInt(chatConfig.messages_per_hour, 10),
        quota_chats_per_minute: parseInt(chatConfig.quota_chats_per_minute, 10),
        chats_per_day: parseInt(chatConfig.chats_per_day, 10),
        max_document_pages: parseInt(chatConfig.max_document_pages, 10),
        max_document_size_mb: parseInt(chatConfig.max_document_size_mb, 10),
        max_file_upload_per_day: parseInt(chatConfig.max_file_upload_per_day, 10),
        max_upload_files: parseInt(chatConfig.max_upload_files, 10),
        streaming_delay: parseInt(chatConfig.streaming_delay, 10),
      };
      const response = await axios.put(CHAT_CONFIG_API_URL, payload, { headers: getAuthHeaders() });
      const updated = response.data?.data || chatConfig;
      setChatConfig({ ...DEFAULT_CHAT_CONFIG, ...updated });
      setChatConfigOriginal({ ...DEFAULT_CHAT_CONFIG, ...updated });
      MySwal.fire({ icon: 'success', title: 'Config Saved', text: 'Chat LLM configuration updated successfully.', confirmButtonColor: '#16a34a', timer: 2000 });
    } catch (error) {
      const errors = error.response?.data?.errors;
      MySwal.fire({ icon: 'error', title: 'Save failed', text: errors ? errors.join('\n') : (error.response?.data?.message || 'Unable to save configuration.'), confirmButtonColor: '#dc2626' });
    } finally {
      setChatConfigSaving(false);
    }
  };

  const handleCancelChatConfig = () => setChatConfig({ ...chatConfigOriginal });

  const handleSumConfigChange = (field, value) => setSumConfig((prev) => ({ ...prev, [field]: value }));

  const handleSaveSummarizationConfig = async () => {
    setSumConfigSaving(true);
    try {
      const payload = {
        llm_model: sumConfig.llm_model,
        llm_provider: String(sumConfig.llm_provider || 'google').trim(),
        model_temperature: parseFloat(sumConfig.model_temperature),
        max_output_tokens: parseInt(sumConfig.max_output_tokens, 10),
        streaming_delay: parseInt(sumConfig.streaming_delay, 10),
        embedding_provider: String(sumConfig.embedding_provider || '').trim(),
        embedding_model: String(sumConfig.embedding_model || '').trim(),
        embedding_dimension: parseInt(sumConfig.embedding_dimension, 10),
        retrieval_top_k: parseInt(sumConfig.retrieval_top_k, 10),
        use_hybrid_search: Boolean(sumConfig.use_hybrid_search),
        use_rrf: Boolean(sumConfig.use_rrf),
        semantic_weight: parseFloat(sumConfig.semantic_weight),
        keyword_weight: parseFloat(sumConfig.keyword_weight),
        text_search_language: String(sumConfig.text_search_language || 'english').trim(),
      };
      const response = await axios.put(SUMMARIZATION_CONFIG_API_URL, payload, { headers: getAuthHeaders() });
      const updated = response.data?.data || sumConfig;
      const merged = { ...DEFAULT_SUMMARIZATION_CONFIG, ...updated };
      if (typeof merged.use_hybrid_search === 'string') merged.use_hybrid_search = merged.use_hybrid_search === 'true' || merged.use_hybrid_search === 't';
      if (typeof merged.use_rrf === 'string') merged.use_rrf = merged.use_rrf === 'true' || merged.use_rrf === 't';
      setSumConfig(merged);
      setSumConfigOriginal({ ...merged });
      MySwal.fire({ icon: 'success', title: 'Config Saved', text: 'Summarization chat configuration updated successfully.', confirmButtonColor: '#16a34a', timer: 2000 });
    } catch (error) {
      const errors = error.response?.data?.errors;
      MySwal.fire({ icon: 'error', title: 'Save failed', text: errors ? errors.join('\n') : (error.response?.data?.message || 'Unable to save configuration.'), confirmButtonColor: '#dc2626' });
    } finally {
      setSumConfigSaving(false);
    }
  };

  const handleCancelSummarizationConfig = () => setSumConfig({ ...sumConfigOriginal });

  const filteredMaxTokens = useMemo(() => {
    const query = searchValue.toLowerCase();
    return llmMaxTokens.filter((entry) => {
      const provider = entry.provider?.toLowerCase() || '';
      const modelName = entry.model_name?.toLowerCase() || '';
      return provider.includes(query) || modelName.includes(query);
    });
  }, [llmMaxTokens, searchValue]);

  const beginEditingEntry = (entry) => {
    setEditingEntryId(entry.id);
    setMaxTokenEditForm({ provider: entry.provider || '', model_name: entry.model_name || '', max_output_tokens: entry.max_output_tokens?.toString() || '' });
  };

  const cancelEditingEntry = () => {
    setEditingEntryId(null);
    setMaxTokenEditForm({ provider: '', model_name: '', max_output_tokens: '' });
  };

  const handleEditFieldChange = (field, value) => setMaxTokenEditForm((prev) => ({ ...prev, [field]: value }));
  const handleNewEntryFieldChange = (field, value) => setNewEntryForm((prev) => ({ ...prev, [field]: value }));

  const startAddingNewEntry = () => {
    setIsAddingNewEntry(true);
    setNewEntryForm({ provider: '', model_name: '', max_output_tokens: '', model_id: '' });
  };

  const cancelNewEntry = () => {
    setIsAddingNewEntry(false);
    setNewEntryForm({ provider: '', model_name: '', max_output_tokens: '', model_id: '' });
  };

  const saveMaxTokenEntry = async () => {
    if (!editingEntryId) return;
    const { provider, model_name, max_output_tokens } = maxTokenEditForm;
    if (!provider.trim() || !model_name.trim() || !max_output_tokens) {
      MySwal.fire({ icon: 'warning', title: 'Incomplete details', text: 'Please provide provider, model name, and max tokens.', confirmButtonColor: '#f97316' });
      return;
    }
    const parsedTokens = parseInt(max_output_tokens, 10);
    if (Number.isNaN(parsedTokens) || parsedTokens <= 0) {
      MySwal.fire({ icon: 'warning', title: 'Invalid max tokens', text: 'Max tokens must be a positive number.', confirmButtonColor: '#f97316' });
      return;
    }
    try {
      setMaxTokenSavingId(editingEntryId);
      await axios.put(`${LLM_MAX_TOKENS_API_URL}/${editingEntryId}`, { provider: provider.trim(), model_name: model_name.trim(), max_output_tokens: parsedTokens }, { headers: getAuthHeaders() });
      await fetchLlmMaxTokens();
      cancelEditingEntry();
      MySwal.fire({ icon: 'success', title: 'Max tokens updated', text: 'The LLM max token entry was saved successfully.', confirmButtonColor: '#16a34a', timer: 2000 });
    } catch (error) {
      MySwal.fire({ icon: 'error', title: 'Update failed', text: error.response?.data?.message || 'Unable to update this entry.', confirmButtonColor: '#dc2626' });
    } finally {
      setMaxTokenSavingId(null);
    }
  };

  const saveNewMaxTokenEntry = async () => {
    const { provider, model_name, max_output_tokens, model_id } = newEntryForm;
    if (!provider.trim() || !model_name.trim() || !max_output_tokens || !model_id) {
      MySwal.fire({ icon: 'warning', title: 'Incomplete details', text: 'Please provide provider, model name, linked model, and max tokens.', confirmButtonColor: '#f97316' });
      return;
    }
    const parsedTokens = parseInt(max_output_tokens, 10);
    const parsedModelId = parseInt(model_id, 10);
    if (Number.isNaN(parsedTokens) || parsedTokens <= 0) {
      MySwal.fire({ icon: 'warning', title: 'Invalid max tokens', text: 'Max tokens must be a positive number.', confirmButtonColor: '#f97316' });
      return;
    }
    if (Number.isNaN(parsedModelId) || parsedModelId <= 0) {
      MySwal.fire({ icon: 'warning', title: 'Invalid model selection', text: 'Please select a valid model.', confirmButtonColor: '#f97316' });
      return;
    }
    try {
      setAddingEntryLoading(true);
      await axios.post(LLM_MAX_TOKENS_API_URL, { provider: provider.trim(), model_name: model_name.trim(), max_output_tokens: parsedTokens, model_id: parsedModelId }, { headers: getAuthHeaders() });
      await fetchLlmMaxTokens();
      cancelNewEntry();
      MySwal.fire({ icon: 'success', title: 'Max tokens entry added', text: 'The new LLM max token entry was created successfully.', confirmButtonColor: '#16a34a', timer: 2000 });
    } catch (error) {
      MySwal.fire({ icon: 'error', title: 'Creation failed', text: error.response?.data?.message || 'Unable to add this entry.', confirmButtonColor: '#dc2626' });
    } finally {
      setAddingEntryLoading(false);
    }
  };

  const handleAddLlmModel = async () => {
    if (!newLlmModelName.trim()) {
      MySwal.fire({ icon: 'warning', title: 'Name required', text: 'Enter an LLM model name.', confirmButtonColor: '#f97316' });
      return;
    }
    setAddingLlmLoading(true);
    try {
      await axios.post(LLM_API_URL, { name: newLlmModelName.trim() }, { headers: getAuthHeaders() });
      setNewLlmModelName('');
      await fetchLlmModels();
      MySwal.fire({ icon: 'success', title: 'LLM added', timer: 2000, showConfirmButton: false });
    } catch (error) {
      MySwal.fire({ icon: 'error', title: 'Could not add LLM', text: error.response?.data?.message || 'Please try again.', confirmButtonColor: '#dc2626' });
    } finally {
      setAddingLlmLoading(false);
    }
  };

  const handleDeleteLlmModel = async (model) => {
    const result = await MySwal.fire({
      title: `Delete "${model.name}"?`,
      text: 'This permanently removes the LLM model. Prompts using it must be updated first.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;

    setLlmModelDeletingId(model.id);
    try {
      await axios.delete(`${LLM_API_URL}/${model.id}`, { headers: getAuthHeaders() });
      setLlmModels((prev) => prev.filter((m) => m.id !== model.id));
      await fetchLlmMaxTokens();
      MySwal.fire({ icon: 'success', title: 'Deleted', timer: 2000, showConfirmButton: false });
    } catch (error) {
      MySwal.fire({
        icon: 'error',
        title: 'Cannot delete',
        text: error.response?.data?.message || 'Unable to delete this LLM model.',
        confirmButtonColor: '#dc2626',
      });
    } finally {
      setLlmModelDeletingId(null);
    }
  };

  const handleDeleteMaxTokenEntry = async (entry) => {
    const result = await MySwal.fire({
      title: 'Delete this entry?',
      text: `${entry.provider} / ${entry.model_name} will be removed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;

    setMaxTokenDeletingId(entry.id);
    try {
      await axios.delete(`${LLM_MAX_TOKENS_API_URL}/${entry.id}`, { headers: getAuthHeaders() });
      setLlmMaxTokens((prev) => prev.filter((e) => e.id !== entry.id));
      MySwal.fire({ icon: 'success', title: 'Entry deleted', timer: 2000, showConfirmButton: false });
    } catch (error) {
      MySwal.fire({ icon: 'error', title: 'Delete failed', text: error.response?.data?.message || 'Please try again.', confirmButtonColor: '#dc2626' });
    } finally {
      setMaxTokenDeletingId(null);
    }
  };

  /* ─────────────────────── Loading screen ─────────────────────── */
  if (loading) {
    return (
      <div className="w-full min-h-[50vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border-4 border-slate-100" />
            <div className="absolute inset-0 rounded-full border-4 border-blue-600 border-t-transparent animate-spin" />
            <div className="absolute inset-2.5 rounded-full bg-slate-50 flex items-center justify-center">
              <Bot size={16} className="text-blue-600" />
            </div>
          </div>
          <div>
            <p className="text-slate-700 font-semibold text-sm">Loading LLM Management</p>
            <p className="text-slate-400 text-xs mt-0.5">Fetching configuration…</p>
          </div>
        </div>
      </div>
    );
  }

  /* ──────────────────────── Tab config ──────────────────────── */
  const tabs = [
    { id: 'llm-models',        label: 'LLM Models',          icon: Bot           },
    { id: 'max-tokens',        label: 'LLM Max Tokens',     icon: Database      },
    { id: 'chat-model',        label: 'Chat Model',          icon: MessageSquare },
    { id: 'summarization-chat',label: 'Summarization Chat',  icon: BookOpen      },
  ];

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <div className="w-full">

      {/* ── Page Header ── */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="w-full px-4 md:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
              <Bot size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800 tracking-tight">LLM Management</h1>
              <p className="text-xs text-slate-400 mt-0.5">Configure token limits, model settings, and AI parameters</p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-slate-600
                       shadow-sm hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {/* ── Tab Bar ── */}
        <div className="w-full px-4 md:px-6 lg:px-8 flex gap-0.5 pb-0 border-t border-slate-100">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
                className={`flex items-center gap-2 px-4 md:px-5 py-3 text-sm font-semibold border-b-2 transition-colors duration-150 ${
                  active
                    ? 'border-blue-600 text-blue-700 bg-blue-50/80'
                    : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                }`}
              >
                <tab.icon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Page Body ── */}
      <div className="w-full px-4 md:px-6 lg:px-8 py-6 md:py-8">

        {/* ════════════════ TAB: LLM Models ════════════════ */}
        {activeTab === 'llm-models' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Registered LLM Models</h2>
              <p className="text-sm text-slate-400 mt-0.5">Add or remove LLM models available for prompts and token limits.</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">New model name</label>
                  <input
                    type="text"
                    value={newLlmModelName}
                    onChange={(e) => setNewLlmModelName(e.target.value)}
                    placeholder="e.g. gemini-2.5-flash"
                    className={inputCls}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddLlmModel()}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddLlmModel}
                  disabled={addingLlmLoading}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  <Plus size={14} />
                  {addingLlmLoading ? 'Adding…' : 'Add LLM'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Model name', 'Status', 'Added', 'Actions'].map((h) => (
                      <th key={h} className={`px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider ${h === 'Actions' ? 'text-right' : 'text-left'}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {llmModels.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-12 text-center text-sm text-slate-500">No LLM models yet. Add one above.</td>
                    </tr>
                  ) : (
                    llmModels.map((model) => (
                      <tr key={model.id} className="hover:bg-slate-50/80">
                        <td className="px-5 py-3.5 text-sm font-semibold text-slate-800">{model.name}</td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${model.is_active !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                            {model.is_active !== false ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-400">
                          {model.created_at ? new Date(model.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteLlmModel(model)}
                            disabled={llmModelDeletingId === model.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
                          >
                            <Trash2 size={12} />
                            {llmModelDeletingId === model.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ════════════════ TAB: LLM Max Tokens ════════════════ */}
        {activeTab === 'max-tokens' && (
          <div className="space-y-6">
            {/* Controls row */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Token Limit Registry</h2>
                <p className="text-sm text-slate-400 mt-0.5">Define the maximum output tokens per provider and model.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search provider or model…"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="pl-9 pr-4 py-2.5 text-sm bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 w-full min-w-[200px] max-w-xs"
                  />
                </div>
                <button
                  onClick={startAddingNewEntry}
                  disabled={isAddingNewEntry}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 active:scale-[0.99] transition-colors disabled:opacity-50"
                >
                  <Plus size={14} />
                  Add Entry
                </button>
              </div>
            </div>

            {/* Table card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden w-full">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      {['Provider', 'Model Name', 'Linked Model', 'Max Tokens', 'Last Updated', 'Actions'].map((h, i) => (
                        <th
                          key={h}
                          className={`px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider ${i === 5 ? 'text-right' : 'text-left'}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {/* New entry row */}
                    {isAddingNewEntry && (
                      <tr className="bg-slate-50">
                        <td className="px-5 py-3">
                          <input type="text" value={newEntryForm.provider} onChange={(e) => handleNewEntryFieldChange('provider', e.target.value)} className={inputCls} placeholder="Provider" />
                        </td>
                        <td className="px-5 py-3">
                          <input type="text" value={newEntryForm.model_name} onChange={(e) => handleNewEntryFieldChange('model_name', e.target.value)} className={inputCls} placeholder="Model name" />
                        </td>
                        <td className="px-5 py-3">
                          <select value={newEntryForm.model_id} onChange={(e) => handleNewEntryFieldChange('model_id', e.target.value)} className={selectCls}>
                            <option value="">Select linked LLM</option>
                            {llmModels.map((model) => (<option key={model.id} value={model.id}>{model.name}</option>))}
                          </select>
                        </td>
                        <td className="px-5 py-3">
                          <input type="number" min="1" value={newEntryForm.max_output_tokens} onChange={(e) => handleNewEntryFieldChange('max_output_tokens', e.target.value)} className={inputCls} placeholder="Max tokens" />
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-400">—</td>
                        <td className="px-5 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button onClick={cancelNewEntry} disabled={addingEntryLoading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50">
                              <X size={12} /> Cancel
                            </button>
                            <button onClick={saveNewMaxTokenEntry} disabled={addingEntryLoading} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50">
                              <Check size={12} />{addingEntryLoading ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}

                    {filteredMaxTokens.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="px-5 py-16 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                              <Database size={20} className="text-slate-400" />
                            </div>
                            <p className="text-sm text-slate-500 font-medium">No entries found</p>
                            <p className="text-xs text-slate-400">Try adjusting your search or add a new entry.</p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredMaxTokens.map((entry) => {
                        const isEditing = editingEntryId === entry.id;
                        return (
                          <tr key={entry.id} className={`transition-colors ${isEditing ? 'bg-slate-50' : 'hover:bg-slate-50/80'}`}>
                            <td className="px-5 py-3.5">
                              {isEditing
                                ? <input type="text" value={maxTokenEditForm.provider} onChange={(e) => handleEditFieldChange('provider', e.target.value)} className={inputCls} />
                                : (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold capitalize border border-slate-200">
                                    {entry.provider}
                                  </span>
                                )}
                            </td>
                            <td className="px-5 py-3.5">
                              {isEditing
                                ? <input type="text" value={maxTokenEditForm.model_name} onChange={(e) => handleEditFieldChange('model_name', e.target.value)} className={inputCls} />
                                : <span className="text-sm font-semibold text-slate-700">{entry.model_name}</span>}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="text-sm text-slate-500">{entry.llm_model_name || '—'}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              {isEditing
                                ? <input type="number" min="1" value={maxTokenEditForm.max_output_tokens} onChange={(e) => handleEditFieldChange('max_output_tokens', e.target.value)} className={inputCls} />
                                : (
                                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-slate-700">
                                    <Hash size={11} className="text-slate-400" />
                                    {entry.max_output_tokens?.toLocaleString() || '—'}
                                  </span>
                                )}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-slate-400">
                              {entry.updated_at ? new Date(entry.updated_at).toLocaleString() : '—'}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              {isEditing ? (
                                <div className="flex justify-end gap-2">
                                  <button onClick={cancelEditingEntry} disabled={maxTokenSavingId === entry.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-50">
                                    <X size={12} /> Cancel
                                  </button>
                                  <button onClick={saveMaxTokenEntry} disabled={maxTokenSavingId === entry.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50">
                                    <Check size={12} />{maxTokenSavingId === entry.id ? 'Saving…' : 'Save'}
                                  </button>
                                </div>
                              ) : (
                                <div className="flex justify-end gap-2">
                                  <button type="button" onClick={() => beginEditingEntry(entry)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors">
                                    <Edit2 size={12} /> Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMaxTokenEntry(entry)}
                                    disabled={maxTokenDeletingId === entry.id}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-700 text-xs font-semibold hover:bg-red-50 disabled:opacity-50"
                                  >
                                    <Trash2 size={12} />
                                    {maxTokenDeletingId === entry.id ? 'Deleting…' : 'Delete'}
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Table footer */}
              {filteredMaxTokens.length > 0 && (
                <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
                  <p className="text-xs text-slate-400">{filteredMaxTokens.length} {filteredMaxTokens.length === 1 ? 'entry' : 'entries'}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════ TAB: Chat Model ════════════════ */}
        {activeTab === 'chat-model' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Chat Model Configuration</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Global model settings (provider, temperature, output tokens). Rate &amp; quota limits are managed per-plan in{' '}
                <span className="text-blue-600 font-medium">Subscription Management</span>.
              </p>
            </div>

            {chatConfigLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center space-y-3">
                  <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-slate-400">Loading chat config…</p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <SectionCard icon={Cpu} title="Model & Generation" description="LLM provider, model, generation parameters">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <FormField label="LLM Model" icon={Bot} hint="The model used for all chat sessions.">
                      <select value={chatConfig.llm_model} onChange={(e) => handleChatConfigChange('llm_model', e.target.value)} className={selectCls}>
                        {llmModels.map((model) => (<option key={model.id} value={model.name}>{model.name}</option>))}
                      </select>
                    </FormField>
                    <FormField label="LLM Provider" icon={Layers} hint="Provider identifier (e.g. google, openai).">
                      <input type="text" value={chatConfig.llm_provider ?? ''} onChange={(e) => handleChatConfigChange('llm_provider', e.target.value)} className={inputCls} placeholder="e.g. google" />
                    </FormField>
                    <FormField label="Model Temperature" icon={Thermometer} hint="Higher = more creative responses.">
                      <input type="number" min="0" max="2" step="0.1" value={chatConfig.model_temperature} onChange={(e) => handleChatConfigChange('model_temperature', e.target.value)} className={inputCls} />
                    </FormField>
                    <FormField label="Max Output Tokens" icon={Hash} hint="Maximum tokens the LLM can generate per response.">
                      <input type="number" min="1" value={chatConfig.max_output_tokens} onChange={(e) => handleChatConfigChange('max_output_tokens', e.target.value)} className={inputCls} />
                    </FormField>
                    <FormField label="Streaming Delay (ms)" icon={Zap} hint="Delay between streaming chunks.">
                      <input type="number" min="0" value={chatConfig.streaming_delay} onChange={(e) => handleChatConfigChange('streaming_delay', e.target.value)} className={inputCls} />
                    </FormField>
                  </div>
                </SectionCard>

                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={handleCancelChatConfig} disabled={chatConfigSaving} className="px-6 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50">
                    Discard Changes
                  </button>
                  <button type="button" onClick={handleSaveChatConfig} disabled={chatConfigSaving} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {chatConfigSaving ? (<><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>) : (<><Save size={14} /> Save Configuration</>)}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════ TAB: Summarization Chat ════════════════ */}
        {activeTab === 'summarization-chat' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Summarization Chat Configuration</h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Model settings, embeddings and retrieval pipeline. Rate &amp; quota limits are managed per-plan in{' '}
                <span className="text-blue-600 font-medium">Subscription Management</span>.
              </p>
            </div>

            {sumConfigLoading ? (
              <div className="flex items-center justify-center py-24">
                <div className="text-center space-y-3">
                  <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                  <p className="text-sm text-slate-400">Loading summarization config…</p>
                </div>
              </div>
            ) : (
              <div className="space-y-5">

                {/* Section: LLM & Generation */}
                <SectionCard icon={Cpu} title="LLM & Generation" description="LLM provider, model, generation parameters for summarization">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    <FormField label="LLM Model" icon={Bot} hint="The model used for summarization sessions.">
                      <select value={sumConfig.llm_model ?? ''} onChange={(e) => handleSumConfigChange('llm_model', e.target.value)} className={selectCls}>
                        {llmModels.map((model) => (<option key={model.id} value={model.name}>{model.name}</option>))}
                      </select>
                    </FormField>
                    <FormField label="LLM Provider" icon={Layers} hint="Provider identifier (e.g. google, openai).">
                      <input type="text" value={sumConfig.llm_provider ?? ''} onChange={(e) => handleSumConfigChange('llm_provider', e.target.value)} className={inputCls} placeholder="e.g. google" />
                    </FormField>
                    <FormField label="Model Temperature" icon={Thermometer} hint="Higher = more creative responses.">
                      <input type="number" min="0" max="2" step="0.1" value={sumConfig.model_temperature ?? ''} onChange={(e) => handleSumConfigChange('model_temperature', e.target.value)} className={inputCls} />
                    </FormField>
                    <FormField label="Max Output Tokens" icon={Hash} hint="Maximum tokens the LLM can generate per response.">
                      <input type="number" min="1" value={sumConfig.max_output_tokens} onChange={(e) => handleSumConfigChange('max_output_tokens', e.target.value)} className={inputCls} />
                    </FormField>
                    <FormField label="Streaming Delay (ms)" icon={Zap} hint="Delay between streaming chunks.">
                      <input type="number" min="0" value={sumConfig.streaming_delay ?? ''} onChange={(e) => handleSumConfigChange('streaming_delay', e.target.value)} className={inputCls} />
                    </FormField>
                  </div>
                </SectionCard>

                {/* Section: Embeddings & Retrieval */}
                <SectionCard icon={Search} title="Embeddings & Retrieval" description="Vector embedding configuration and retrieval pipeline settings">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    <FormField label="Embedding Provider" icon={Layers} hint="Provider for generating vector embeddings.">
                      <input type="text" value={sumConfig.embedding_provider ?? ''} onChange={(e) => handleSumConfigChange('embedding_provider', e.target.value)} className={inputCls} />
                    </FormField>
                    <FormField label="Embedding Model" icon={Bot} hint="Specific embedding model to use.">
                      <input type="text" value={sumConfig.embedding_model ?? ''} onChange={(e) => handleSumConfigChange('embedding_model', e.target.value)} className={inputCls} />
                    </FormField>
                    <FormField label="Embedding Dimension" icon={Hash} hint="Vector dimensionality of the embedding model.">
                      <input type="number" min="1" value={sumConfig.embedding_dimension} onChange={(e) => handleSumConfigChange('embedding_dimension', e.target.value)} className={inputCls} />
                    </FormField>
                    <FormField label="Retrieval Top K" icon={BarChart2} hint="Number of top results to retrieve per query.">
                      <input type="number" min="1" value={sumConfig.retrieval_top_k} onChange={(e) => handleSumConfigChange('retrieval_top_k', e.target.value)} className={inputCls} />
                    </FormField>
                  </div>
                </SectionCard>

                {/* Section: Hybrid Search */}
                <SectionCard icon={Activity} title="Hybrid Search & Weights" description="Reciprocal rank fusion and semantic/keyword search balancing">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <ToggleSwitch
                        checked={!!sumConfig.use_hybrid_search}
                        onChange={(v) => handleSumConfigChange('use_hybrid_search', v)}
                        label="Use Hybrid Search"
                        description="Combine semantic and keyword search results."
                      />
                      <ToggleSwitch
                        checked={!!sumConfig.use_rrf}
                        onChange={(v) => handleSumConfigChange('use_rrf', v)}
                        label="Use RRF"
                        description="Apply Reciprocal Rank Fusion to merge result lists."
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
                      <FormField label="Semantic Weight (0–1)" icon={BarChart2} hint="Weight applied to vector similarity results.">
                        <input type="number" min="0" max="1" step="0.05" value={sumConfig.semantic_weight} onChange={(e) => handleSumConfigChange('semantic_weight', e.target.value)} className={inputCls} />
                      </FormField>
                      <FormField label="Keyword Weight (0–1)" icon={BarChart2} hint="Weight applied to full-text search results.">
                        <input type="number" min="0" max="1" step="0.05" value={sumConfig.keyword_weight} onChange={(e) => handleSumConfigChange('keyword_weight', e.target.value)} className={inputCls} />
                      </FormField>
                      <FormField label="Text Search Language" icon={Search} hint="PostgreSQL FTS language configuration.">
                        <input type="text" value={sumConfig.text_search_language ?? ''} onChange={(e) => handleSumConfigChange('text_search_language', e.target.value)} className={inputCls} placeholder="english" />
                      </FormField>
                    </div>
                  </div>
                </SectionCard>

                {/* Action Bar */}
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={handleCancelSummarizationConfig} disabled={sumConfigSaving} className="px-6 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50">
                    Discard Changes
                  </button>
                  <button type="button" onClick={handleSaveSummarizationConfig} disabled={sumConfigSaving} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-50">
                    {sumConfigSaving ? (<><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving…</>) : (<><Save size={14} /> Save Configuration</>)}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default LLMManagement;
