import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { Bot, Database, Filter, RefreshCw, Save, CheckCircle2, AlertTriangle } from 'lucide-react';
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

const LLMManagement = () => {
  const [userInfo, setUserInfo] = useState(null);
  const [llmModels, setLlmModels] = useState([]);
  const [currentSelection, setCurrentSelection] = useState(null);
  const [selectedLlmId, setSelectedLlmId] = useState('');
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [llmMaxTokens, setLlmMaxTokens] = useState([]);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [maxTokenEditForm, setMaxTokenEditForm] = useState({
    provider: '',
    model_name: '',
    max_output_tokens: '',
  });
  const [maxTokenSavingId, setMaxTokenSavingId] = useState(null);
  const [isAddingNewEntry, setIsAddingNewEntry] = useState(false);
  const [newEntryForm, setNewEntryForm] = useState({
    provider: '',
    model_name: '',
    max_output_tokens: '',
    model_id: '',
  });
  const [addingEntryLoading, setAddingEntryLoading] = useState(false);

  const LLM_API_URL = `${API_BASE_URL}/llm`;
  const CUSTOM_QUERY_API_URL = `${API_BASE_URL}/custom-query`;
  const LLM_MAX_TOKENS_API_URL = `${API_BASE_URL}/llm/max-tokens`;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      MySwal.fire({
        icon: 'warning',
        title: 'Authentication Required',
        text: 'Please login to access this page.',
        confirmButtonColor: '#2563eb',
      });
      return;
    }

    const decoded = decodeToken(token);
    if (!decoded) {
      MySwal.fire({
        icon: 'error',
        title: 'Authentication Error',
        text: 'Invalid token. Please login again.',
        confirmButtonColor: '#dc2626',
      }).then(() => {
        localStorage.removeItem('token');
      });
      return;
    }

    setUserInfo({
      name: decoded.name || decoded.username,
      role: decoded.role || decoded.userRole,
      email: decoded.email,
    });
  }, []);

  useEffect(() => {
    if (!userInfo) return;
    const fetchData = async () => {
      await Promise.all([fetchLlmModels(), fetchCurrentSelection(), fetchLlmMaxTokens()]);
      setLoading(false);
    };
    fetchData();
  }, [userInfo]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const fetchLlmModels = async () => {
    try {
      const response = await axios.get(LLM_API_URL, {
        headers: getAuthHeaders(),
      });
      setLlmModels(response.data || []);
    } catch (error) {
      console.error('Error fetching LLM models:', error);
      MySwal.fire({
        icon: 'error',
        title: 'Unable to load models',
        text: error.response?.data?.message || 'Please try again later.',
        confirmButtonColor: '#dc2626',
      });
    }
  };

  const fetchLlmMaxTokens = async () => {
    try {
      const response = await axios.get(LLM_MAX_TOKENS_API_URL, {
        headers: getAuthHeaders(),
      });
      setLlmMaxTokens(response.data || []);
    } catch (error) {
      console.error('Error fetching LLM max token entries:', error);
      MySwal.fire({
        icon: 'error',
        title: 'Unable to load max tokens',
        text: error.response?.data?.message || 'Please try again later.',
        confirmButtonColor: '#dc2626',
      });
    }
  };

  const fetchCurrentSelection = async () => {
    try {
      const response = await axios.get(CUSTOM_QUERY_API_URL, {
        headers: getAuthHeaders(),
      });
      setCurrentSelection(response.data);
      if (response.data?.llm_model_id) {
        setSelectedLlmId(response.data.llm_model_id);
      }
    } catch (error) {
      console.error('Error fetching custom query selection:', error);
      MySwal.fire({
        icon: 'error',
        title: 'Unable to load selection',
        text: error.response?.data?.message || 'Please try again later.',
        confirmButtonColor: '#dc2626',
      });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchLlmModels(), fetchCurrentSelection(), fetchLlmMaxTokens()]);
    setRefreshing(false);
  };

  const handleSaveSelection = async () => {
    if (!selectedLlmId) {
      MySwal.fire({
        icon: 'warning',
        title: 'Select an LLM',
        text: 'Please choose an LLM model before saving.',
        confirmButtonColor: '#f97316',
      });
      return;
    }

    setSaving(true);
    try {
      const response = await axios.post(
        CUSTOM_QUERY_API_URL,
        { llm_model_id: parseInt(selectedLlmId, 10) },
        { headers: getAuthHeaders() }
      );

      setCurrentSelection(response.data?.data || null);

      MySwal.fire({
        icon: 'success',
        title: 'LLM Saved',
        text: 'Custom query LLM was updated successfully.',
        confirmButtonColor: '#16a34a',
        timer: 2000,
      });
    } catch (error) {
      console.error('Error saving custom query LLM:', error);
      MySwal.fire({
        icon: 'error',
        title: 'Save failed',
        text: error.response?.data?.message || 'Unable to save selection.',
        confirmButtonColor: '#dc2626',
      });
    } finally {
      setSaving(false);
    }
  };

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
    setMaxTokenEditForm({
      provider: entry.provider || '',
      model_name: entry.model_name || '',
      max_output_tokens: entry.max_output_tokens?.toString() || '',
    });
  };

  const cancelEditingEntry = () => {
    setEditingEntryId(null);
    setMaxTokenEditForm({
      provider: '',
      model_name: '',
      max_output_tokens: '',
    });
  };

  const handleEditFieldChange = (field, value) => {
    setMaxTokenEditForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleNewEntryFieldChange = (field, value) => {
    setNewEntryForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const startAddingNewEntry = () => {
    setIsAddingNewEntry(true);
    setNewEntryForm({
      provider: '',
      model_name: '',
      max_output_tokens: '',
      model_id: '',
    });
  };

  const cancelNewEntry = () => {
    setIsAddingNewEntry(false);
    setNewEntryForm({
      provider: '',
      model_name: '',
      max_output_tokens: '',
      model_id: '',
    });
  };

  const saveMaxTokenEntry = async () => {
    if (!editingEntryId) return;

    const { provider, model_name, max_output_tokens } = maxTokenEditForm;

    if (!provider.trim() || !model_name.trim() || !max_output_tokens) {
      MySwal.fire({
        icon: 'warning',
        title: 'Incomplete details',
        text: 'Please provide provider, model name, and max tokens.',
        confirmButtonColor: '#f97316',
      });
      return;
    }

    const parsedTokens = parseInt(max_output_tokens, 10);
    if (Number.isNaN(parsedTokens) || parsedTokens <= 0) {
      MySwal.fire({
        icon: 'warning',
        title: 'Invalid max tokens',
        text: 'Max tokens must be a positive number.',
        confirmButtonColor: '#f97316',
      });
      return;
    }

    try {
      setMaxTokenSavingId(editingEntryId);
      await axios.put(
        `${LLM_MAX_TOKENS_API_URL}/${editingEntryId}`,
        {
          provider: provider.trim(),
          model_name: model_name.trim(),
          max_output_tokens: parsedTokens,
        },
        { headers: getAuthHeaders() }
      );

      await fetchLlmMaxTokens();
      cancelEditingEntry();

      MySwal.fire({
        icon: 'success',
        title: 'Max tokens updated',
        text: 'The LLM max token entry was saved successfully.',
        confirmButtonColor: '#16a34a',
        timer: 2000,
      });
    } catch (error) {
      console.error('Error updating max token entry:', error);
      MySwal.fire({
        icon: 'error',
        title: 'Update failed',
        text: error.response?.data?.message || 'Unable to update this entry.',
        confirmButtonColor: '#dc2626',
      });
    } finally {
      setMaxTokenSavingId(null);
    }
  };

  const saveNewMaxTokenEntry = async () => {
    const { provider, model_name, max_output_tokens, model_id } = newEntryForm;

    if (!provider.trim() || !model_name.trim() || !max_output_tokens || !model_id) {
      MySwal.fire({
        icon: 'warning',
        title: 'Incomplete details',
        text: 'Please provide provider, model name, linked model, and max tokens.',
        confirmButtonColor: '#f97316',
      });
      return;
    }

    const parsedTokens = parseInt(max_output_tokens, 10);
    const parsedModelId = parseInt(model_id, 10);

    if (Number.isNaN(parsedTokens) || parsedTokens <= 0) {
      MySwal.fire({
        icon: 'warning',
        title: 'Invalid max tokens',
        text: 'Max tokens must be a positive number.',
        confirmButtonColor: '#f97316',
      });
      return;
    }

    if (Number.isNaN(parsedModelId) || parsedModelId <= 0) {
      MySwal.fire({
        icon: 'warning',
        title: 'Invalid model selection',
        text: 'Please select a valid model.',
        confirmButtonColor: '#f97316',
      });
      return;
    }

    try {
      setAddingEntryLoading(true);
      await axios.post(
        LLM_MAX_TOKENS_API_URL,
        {
          provider: provider.trim(),
          model_name: model_name.trim(),
          max_output_tokens: parsedTokens,
          model_id: parsedModelId,
        },
        { headers: getAuthHeaders() }
      );

      await fetchLlmMaxTokens();
      cancelNewEntry();

      MySwal.fire({
        icon: 'success',
        title: 'Max tokens entry added',
        text: 'The new LLM max token entry was created successfully.',
        confirmButtonColor: '#16a34a',
        timer: 2000,
      });
    } catch (error) {
      console.error('Error creating max token entry:', error);
      MySwal.fire({
        icon: 'error',
        title: 'Creation failed',
        text: error.response?.data?.message || 'Unable to add this entry.',
        confirmButtonColor: '#dc2626',
      });
    } finally {
      setAddingEntryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading LLM Management...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="bg-white rounded-2xl shadow-lg p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
              <Bot className="text-blue-600" size={36} />
              LLM Management
            </h1>
            <p className="text-gray-600 mt-1">
              Select a single global LLM for custom queries. Saving a new one replaces the previous selection.
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {refreshing ? 'Refreshing...' : 'Refresh Data'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <Database className="text-blue-600" />
                Choose Active LLM
              </h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Pick the LLM model that should handle custom queries. Saving will clear previous choices and store only this one.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">LLM Model</label>
                <select
                  value={selectedLlmId || ''}
                  onChange={(e) => setSelectedLlmId(e.target.value ? parseInt(e.target.value, 10) : '')}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select an LLM model</option>
                  {llmModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleSaveSelection}
                disabled={saving}
                className="w-full inline-flex items-center justify-center px-4 py-3 rounded-lg text-white bg-blue-600 hover:bg-blue-700 font-semibold shadow-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Selection
                  </>
                )}
              </button>
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-blue-500 flex-shrink-0" />
                Saving a new LLM wipes previous selections in `custom_query`, ensuring only one active record.
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                <CheckCircle2 className="text-green-600" />
                Current Selection
              </h2>
            </div>
            {currentSelection ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-500">LLM Name</p>
                  <p className="text-lg font-semibold text-gray-900">{currentSelection.llm_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">LLM ID</p>
                  <p className="text-base text-gray-900">{currentSelection.llm_model_id}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Last Updated</p>
                  <p className="text-base text-gray-900">
                    {new Date(currentSelection.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-600">
                <p>No LLM is currently selected. Choose one from the list to get started.</p>
              </div>
            )}
          </div>
        </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">LLM Max Token Settings</h2>
                <p className="text-sm text-gray-500">Review and edit provider, model names, and admin-defined max output tokens.</p>
              </div>
              <div className="flex flex-wrap gap-3 items-center">
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search by provider or model..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <button
                  onClick={startAddingNewEntry}
                  disabled={isAddingNewEntry}
                  className="inline-flex items-center px-4 py-2.5 rounded-lg text-white bg-blue-600 hover:bg-blue-700 text-sm font-semibold disabled:opacity-50"
                >
                  + Add Max Token Entry
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Provider</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Model Name</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Linked Model</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Max Tokens</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Updated</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {isAddingNewEntry && (
                    <tr className="bg-blue-50/50">
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={newEntryForm.provider}
                          onChange={(e) => handleNewEntryFieldChange('provider', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Provider"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={newEntryForm.model_name}
                          onChange={(e) => handleNewEntryFieldChange('model_name', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Model name"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <select
                          value={newEntryForm.model_id}
                          onChange={(e) => handleNewEntryFieldChange('model_id', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Select linked LLM</option>
                          {llmModels.map((model) => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="number"
                          min="1"
                          value={newEntryForm.max_output_tokens}
                          onChange={(e) => handleNewEntryFieldChange('max_output_tokens', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Max tokens"
                        />
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">—</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={cancelNewEntry}
                            className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-100"
                            disabled={addingEntryLoading}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveNewMaxTokenEntry}
                            disabled={addingEntryLoading}
                            className="px-4 py-2 rounded-lg text-white bg-green-600 hover:bg-green-700 text-sm font-semibold disabled:opacity-50"
                          >
                            {addingEntryLoading ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  {filteredMaxTokens.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-6 py-10 text-center text-gray-500">
                        No LLM max token entries match your search.
                      </td>
                    </tr>
                  ) : (
                    filteredMaxTokens.map((entry) => {
                      const isEditing = editingEntryId === entry.id;
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <input
                                type="text"
                                value={maxTokenEditForm.provider}
                                onChange={(e) => handleEditFieldChange('provider', e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            ) : (
                              <p className="text-sm font-semibold text-gray-900 capitalize">{entry.provider}</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <input
                                type="text"
                                value={maxTokenEditForm.model_name}
                                onChange={(e) => handleEditFieldChange('model_name', e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            ) : (
                              <p className="text-sm font-semibold text-gray-900">{entry.model_name}</p>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-gray-900">{entry.llm_model_name || '—'}</p>
                          </td>
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <input
                                type="number"
                                min="1"
                                value={maxTokenEditForm.max_output_tokens}
                                onChange={(e) => handleEditFieldChange('max_output_tokens', e.target.value)}
                                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                              />
                            ) : (
                              <p className="text-sm text-gray-900">{entry.max_output_tokens?.toLocaleString() || '—'}</p>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {entry.updated_at ? new Date(entry.updated_at).toLocaleString() : '—'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {isEditing ? (
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={cancelEditingEntry}
                                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-semibold hover:bg-gray-100"
                                  disabled={maxTokenSavingId === entry.id}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={saveMaxTokenEntry}
                                  disabled={maxTokenSavingId === entry.id}
                                  className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 text-sm font-semibold disabled:opacity-50"
                                >
                                  {maxTokenSavingId === entry.id ? 'Saving...' : 'Save'}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => beginEditingEntry(entry)}
                                className="px-4 py-2 rounded-lg border border-blue-200 text-blue-600 text-sm font-semibold hover:bg-blue-50"
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
      </div>
    </div>
  );
};

export default LLMManagement;

