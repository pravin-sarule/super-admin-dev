import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Eye, Edit, Save, FileText, Trash2, PlusCircle, X,
  ChevronLeft, ChevronRight, Filter, Calendar, Copy, Tag, User, CreditCard
} from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { API_BASE_URL } from '../../config';

const MySwal = withReactContent(Swal);

const SYSTEM_PROMPTS_API_URL = `${API_BASE_URL}/system-prompts`;
const PROMPT_ROLES_API_URL = `${API_BASE_URL}/prompt-roles`;

const formatTokenLimit = (n) => {
  if (n == null || n === '') return null;
  const num = Number(n);
  return Number.isNaN(num) ? null : num.toLocaleString();
};

const PROMPT_TYPE_OPTIONS = [
  { value: 'general', label: 'General (multiple prompts allowed)' },
  { value: 'chat_model', label: 'Chat model service' },
  { value: 'summarization', label: 'Summarization service' },
  { value: 'charter', label: 'Charter' },
  { value: 'banking', label: 'Banking' },
  { value: 'finance', label: 'Finance' },
];

const serviceLabel = (t) => {
  const map = {
    chat_model: 'Chat Model',
    summarization: 'Summarization',
    charter: 'Charter',
    banking: 'Banking',
    finance: 'Finance',
  };
  return map[t] || 'General';
};

const serviceBadgeClass = (t) => {
  const map = {
    chat_model: 'bg-sky-100 text-sky-800 border-sky-200',
    summarization: 'bg-violet-100 text-violet-800 border-violet-200',
    charter: 'bg-amber-100 text-amber-800 border-amber-200',
    banking: 'bg-green-100 text-green-800 border-green-200',
    finance: 'bg-rose-100 text-rose-800 border-rose-200',
  };
  return map[t] || 'bg-slate-100 text-slate-700 border-slate-200';
};

const EMPTY_FORM = { system_prompt: '', prompt_type: 'general', assigned_role_ids: [], assigned_user_ids: '' };

const SystemPromptManagement = () => {
  const [prompts, setPrompts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(null);
  const [showPromptTable, setShowPromptTable] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPrompt, setNewPrompt] = useState(EMPTY_FORM);
  const [searchValue, setSearchValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [createLoading, setCreateLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState({});
  const [userTokenLimits, setUserTokenLimits] = useState({});
  const [userLimitsLoading, setUserLimitsLoading] = useState(false);

  const getToken = () => localStorage.getItem('token') || sessionStorage.getItem('token');

  const authHeaders = () => ({
    Authorization: `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  });

  const fetchRoles = useCallback(async () => {
    try {
      const res = await axios.get(PROMPT_ROLES_API_URL, { headers: authHeaders() });
      if (res.data.success) setRoles(res.data.data);
    } catch {
      // non-fatal
    }
  }, []);

  const fetchPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(SYSTEM_PROMPTS_API_URL, { headers: authHeaders() });
      if (res.data.success && res.data.data) {
        setPrompts(
          res.data.data.map((p) => ({
            ...p,
            prompt_type: p.prompt_type || 'general',
            assigned_role_ids: p.assigned_role_ids || [],
            assigned_user_ids: p.assigned_user_ids || [],
            assigned_roles_info: p.assigned_roles_info || [],
            created_at: new Date(p.created_at).toLocaleString(),
            updated_at: new Date(p.updated_at).toLocaleString(),
          }))
        );
      } else {
        setPrompts([]);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to fetch system prompts.';
      MySwal.fire({ icon: 'error', title: 'Error!', text: msg, confirmButtonColor: '#3085d6' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchPrompts();
  }, [fetchRoles, fetchPrompts]);

  useEffect(() => {
    const userIds = selectedPrompt?.assigned_user_ids || [];
    if (!selectedPrompt || userIds.length === 0) {
      setUserTokenLimits({});
      return;
    }
    const primaryRoleId = (selectedPrompt.assigned_role_ids || [])[0] || null;

    let cancelled = false;
    (async () => {
      setUserLimitsLoading(true);
      const limits = {};
      await Promise.all(
        userIds.map(async (uid) => {
          try {
            const params = primaryRoleId ? { role_id: primaryRoleId } : {};
            const res = await axios.get(`${PROMPT_ROLES_API_URL}/user/${uid}/token-limit`, {
              headers: authHeaders(),
              params,
            });
            if (res.data?.success) limits[uid] = res.data;
          } catch {
            limits[uid] = { token_limit: null, message: 'Could not resolve' };
          }
        })
      );
      if (!cancelled) {
        setUserTokenLimits(limits);
        setUserLimitsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [selectedPrompt?.id, selectedPrompt?.assigned_user_ids, selectedPrompt?.assigned_role_ids]);

  // ---------- helpers ----------
  const roleNameById = (id) => roles.find((r) => r.id === id)?.name || id;

  const parseUserIds = (val) => {
    if (Array.isArray(val)) return val.map(Number).filter(Boolean);
    return String(val || '').split(',').map((s) => parseInt(s.trim(), 10)).filter(Boolean);
  };

  const userIdsToString = (arr) => (arr || []).join(', ');

  // ---------- CRUD ----------
  const handleCreatePrompt = async () => {
    if (!newPrompt.system_prompt.trim()) {
      MySwal.fire({ icon: 'warning', title: 'Validation Error', text: 'System prompt is required.', confirmButtonColor: '#3085d6' });
      return;
    }
    setCreateLoading(true);
    try {
      const res = await axios.post(
        SYSTEM_PROMPTS_API_URL,
        {
          system_prompt: newPrompt.system_prompt.trim(),
          prompt_type: newPrompt.prompt_type || 'general',
          assigned_role_ids: newPrompt.assigned_role_ids,
          assigned_user_ids: parseUserIds(newPrompt.assigned_user_ids),
        },
        { headers: authHeaders() }
      );
      MySwal.fire({ icon: 'success', title: 'Success!', text: res.data?.message || 'Prompt saved.', confirmButtonColor: '#3085d6', timer: 2500 });
      setNewPrompt(EMPTY_FORM);
      setShowCreateForm(false);
      setShowPromptTable(true);
      fetchPrompts();
    } catch (err) {
      MySwal.fire({ icon: 'error', title: 'Error!', text: err.response?.data?.message || 'Failed to create prompt.', confirmButtonColor: '#3085d6' });
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editedPrompt.system_prompt.trim()) {
      MySwal.fire({ icon: 'warning', title: 'Validation Error', text: 'System prompt cannot be empty.', confirmButtonColor: '#3085d6' });
      return;
    }
    setUpdateLoading(true);
    try {
      await axios.put(
        `${SYSTEM_PROMPTS_API_URL}/${selectedPrompt.id}`,
        {
          system_prompt: editedPrompt.system_prompt.trim(),
          assigned_role_ids: editedPrompt.assigned_role_ids,
          assigned_user_ids: parseUserIds(editedPrompt.assigned_user_ids_str || ''),
        },
        { headers: authHeaders() }
      );
      MySwal.fire({ icon: 'success', title: 'Success!', text: 'Prompt updated.', confirmButtonColor: '#3085d6', timer: 2000 });
      setEditMode(false);
      setEditedPrompt(null);
      setSelectedPrompt(null);
      setShowPromptTable(true);
      fetchPrompts();
    } catch (err) {
      MySwal.fire({ icon: 'error', title: 'Error!', text: err.response?.data?.message || 'Failed to update.', confirmButtonColor: '#3085d6' });
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleDeletePrompt = async (id) => {
    const result = await MySwal.fire({
      title: 'Are you sure?', text: "You won't be able to revert this!", icon: 'warning',
      showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete it!',
    });
    if (!result.isConfirmed) return;
    setDeleteLoading((p) => ({ ...p, [id]: true }));
    try {
      await axios.delete(`${SYSTEM_PROMPTS_API_URL}/${id}`, { headers: authHeaders() });
      MySwal.fire({ icon: 'success', title: 'Deleted!', text: 'Prompt deleted.', confirmButtonColor: '#3085d6', timer: 2000 });
      fetchPrompts();
      if (selectedPrompt?.id === id) { setSelectedPrompt(null); setShowPromptTable(true); }
    } catch (err) {
      MySwal.fire({ icon: 'error', title: 'Error!', text: err.response?.data?.message || 'Failed to delete.', confirmButtonColor: '#3085d6' });
    } finally {
      setDeleteLoading((p) => ({ ...p, [id]: false }));
    }
  };

  // ---------- role multi-select toggle ----------
  const toggleRole = (id, stateKey, setter) => {
    setter((prev) => {
      const current = prev[stateKey] || [];
      const next = current.includes(id) ? current.filter((r) => r !== id) : [...current, id];
      return { ...prev, [stateKey]: next };
    });
  };

  // ---------- filtered / paginated ----------
  const filteredPrompts = useMemo(() => {
    const q = searchValue.toLowerCase();
    return prompts.filter((p) =>
      p.system_prompt.toLowerCase().includes(q) ||
      (p.prompt_type || '').toLowerCase().includes(q) ||
      serviceLabel(p.prompt_type).toLowerCase().includes(q)
    );
  }, [prompts, searchValue]);

  const totalPages = Math.ceil(filteredPrompts.length / itemsPerPage);
  const paginatedPrompts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredPrompts.slice(start, start + itemsPerPage);
  }, [filteredPrompts, currentPage]);

  // ---------- sub-components ----------
  const RoleCheckboxes = ({ selectedIds, onChange }) => (
    <div className="flex flex-wrap gap-3 mt-1">
      {roles.map((r) => (
        <label
          key={r.id}
          className="flex items-start gap-2 cursor-pointer text-sm border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50"
        >
          <input
            type="checkbox"
            checked={selectedIds.includes(r.id)}
            onChange={() => onChange(r.id)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mt-0.5"
          />
          <span>
            <span className="capitalize font-medium block">{r.name}</span>
            {r.plan_info ? (
              <span className="text-xs text-emerald-700 flex items-center gap-1 mt-0.5">
                <CreditCard className="w-3 h-3" />
                {r.plan_info.name} · {formatTokenLimit(r.plan_info.token_limit)} tokens
              </span>
            ) : (
              <span className="text-xs text-gray-400 mt-0.5 block">No plan attached</span>
            )}
          </span>
        </label>
      ))}
      {roles.length === 0 && (
        <p className="text-xs text-gray-400">
          No prompt roles yet. Create prompt roles (with optional plans) under Role Management → Prompt Roles.
        </p>
      )}
    </div>
  );

  if (loading && prompts.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading system prompts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <FileText className="mr-3 text-gray-800" size={32} />
            System Prompt Management
          </h1>
          <p className="text-gray-600 mt-2">Manage system prompts with role & user assignments</p>
        </div>

        {/* Action bar */}
        {showPromptTable && !showCreateForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <button
                onClick={() => { setShowCreateForm(true); setShowPromptTable(false); }}
                className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-md"
              >
                <PlusCircle className="w-5 h-5 mr-2" />
                Create New Prompt
              </button>
              <div className="flex-1 max-w-md relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search prompts..."
                  value={searchValue}
                  onChange={(e) => { setSearchValue(e.target.value); setCurrentPage(1); }}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Create New System Prompt</h2>
              <button onClick={() => { setShowCreateForm(false); setShowPromptTable(true); setNewPrompt(EMPTY_FORM); }} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6">
              {/* Prompt Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Domain / Service <span className="text-red-500">*</span>
                </label>
                <select
                  value={newPrompt.prompt_type}
                  onChange={(e) => setNewPrompt({ ...newPrompt, prompt_type: e.target.value })}
                  className="w-full max-w-xl px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                >
                  {PROMPT_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  <strong>Chat model</strong> and <strong>Summarization</strong> store a single active prompt.
                  Charter, Banking, Finance and General allow multiple.
                </p>
              </div>

              {/* Assign Roles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Tag className="w-4 h-4" /> Assign Roles
                </label>
                <RoleCheckboxes
                  selectedIds={newPrompt.assigned_role_ids}
                  onChange={(id) =>
                    setNewPrompt((prev) => ({
                      ...prev,
                      assigned_role_ids: prev.assigned_role_ids.includes(id)
                        ? prev.assigned_role_ids.filter((r) => r !== id)
                        : [...prev.assigned_role_ids, id],
                    }))
                  }
                />
              </div>

              {/* Assign Solo Users */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <User className="w-4 h-4" /> Assign Solo Users (User IDs, comma-separated)
                </label>
                <input
                  type="text"
                  value={newPrompt.assigned_user_ids}
                  onChange={(e) => setNewPrompt({ ...newPrompt, assigned_user_ids: e.target.value })}
                  placeholder="e.g. 101, 204, 305"
                  className="w-full max-w-xl px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Enter specific user IDs to grant individual access to this prompt.</p>
              </div>

              {/* Prompt Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  System Prompt <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={newPrompt.system_prompt}
                  onChange={(e) => setNewPrompt({ ...newPrompt, system_prompt: e.target.value })}
                  rows={12}
                  placeholder="Enter your system prompt here..."
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-6">
              <button
                onClick={handleCreatePrompt}
                disabled={createLoading}
                className="flex-1 inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
              >
                {createLoading ? 'Creating...' : <><Save className="w-5 h-5 mr-2" />Create System Prompt</>}
              </button>
              <button
                onClick={() => { setShowCreateForm(false); setShowPromptTable(true); setNewPrompt(EMPTY_FORM); }}
                className="px-6 py-3 border border-gray-300 text-base font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Prompts Table */}
        {showPromptTable && !selectedPrompt && (
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['ID', 'Domain', 'Assigned Roles', 'Solo Users', 'Prompt (Preview)', 'Created', 'Actions'].map((h) => (
                      <th key={h} className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-blue-600 mx-auto mb-3"></div>
                      <p className="text-gray-500">Loading...</p>
                    </td></tr>
                  ) : paginatedPrompts.length === 0 ? (
                    <tr><td colSpan={7} className="px-6 py-12 text-center">
                      <FileText className="w-14 h-14 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-lg">No prompts found</p>
                    </td></tr>
                  ) : paginatedPrompts.map((prompt) => (
                    <tr key={prompt.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-4 text-sm font-semibold text-gray-900">#{prompt.id}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${serviceBadgeClass(prompt.prompt_type)}`}>
                          {serviceLabel(prompt.prompt_type)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {(prompt.assigned_roles_info || []).length > 0
                            ? prompt.assigned_roles_info.map((r) => (
                              <span key={r.id} className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs capitalize" title={r.plan_name ? `${r.plan_name}: ${formatTokenLimit(r.token_limit)} tokens` : undefined}>
                                {r.name}
                                {r.token_limit != null && (
                                  <span className="ml-1 text-emerald-700 font-normal">({formatTokenLimit(r.token_limit)})</span>
                                )}
                              </span>
                            ))
                            : <span className="text-xs text-gray-400">—</span>
                          }
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600">
                        {(prompt.assigned_user_ids || []).length > 0
                          ? <span className="flex items-center gap-1"><User className="w-3 h-3" />{prompt.assigned_user_ids.length}</span>
                          : <span className="text-gray-400">—</span>
                        }
                      </td>
                      <td className="px-4 py-4 max-w-xs">
                        <div className="text-sm text-gray-900 truncate">
                          {prompt.system_prompt.length > 80 ? `${prompt.system_prompt.substring(0, 80)}...` : prompt.system_prompt}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-600 whitespace-nowrap">
                        <div className="flex items-center"><Calendar className="w-3 h-3 mr-1 text-gray-400" />{prompt.created_at}</div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => { setSelectedPrompt(prompt); setEditMode(false); setShowPromptTable(false); }}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleDeletePrompt(prompt.id)} disabled={deleteLoading[prompt.id]}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-50">
                            {deleteLoading[prompt.id] ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {!loading && filteredPrompts.length > 0 && (
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <p className="text-sm text-gray-700">
                  Showing <strong>{(currentPage - 1) * itemsPerPage + 1}</strong>–<strong>{Math.min(currentPage * itemsPerPage, filteredPrompts.length)}</strong> of <strong>{filteredPrompts.length}</strong>
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                    <ChevronLeft className="w-4 h-4 mr-1" />Previous
                  </button>
                  <span className="inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50">
                    Next<ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Detail / Edit View */}
        {selectedPrompt && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <button onClick={() => { setSelectedPrompt(null); setShowPromptTable(true); setEditMode(false); setEditedPrompt(null); }}
                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-semibold">
                <ChevronLeft className="w-5 h-5 mr-1" />Back to List
              </button>
              <div className="flex gap-3">
                {editMode ? (
                  <>
                    <button onClick={handleSaveEdit} disabled={updateLoading}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                      {updateLoading ? 'Saving...' : <><Save className="w-4 h-4 mr-2" />Save Changes</>}
                    </button>
                    <button onClick={() => { setEditMode(false); setEditedPrompt(null); }}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50">
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditMode(true); setEditedPrompt({ ...selectedPrompt, assigned_user_ids_str: userIdsToString(selectedPrompt.assigned_user_ids) }); }}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50">
                      <Edit className="w-4 h-4 mr-2" />Edit
                    </button>
                    <button onClick={() => navigator.clipboard.writeText(selectedPrompt.system_prompt).then(() => MySwal.fire({ icon: 'success', title: 'Copied!', timer: 1500, showConfirmButton: false }))}
                      className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50">
                      <Copy className="w-4 h-4 mr-2" />Copy
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ID</label>
                  <p className="text-sm font-semibold text-gray-900">#{selectedPrompt.id}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Domain / Service</label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${serviceBadgeClass(selectedPrompt.prompt_type)}`}>
                    {serviceLabel(selectedPrompt.prompt_type)}
                  </span>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Created At</label>
                  <p className="text-sm text-gray-900 flex items-center"><Calendar className="w-4 h-4 mr-1 text-gray-400" />{selectedPrompt.created_at}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Updated At</label>
                  <p className="text-sm text-gray-900 flex items-center"><Calendar className="w-4 h-4 mr-1 text-gray-400" />{selectedPrompt.updated_at}</p>
                </div>
              </div>

              {/* Assigned Roles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <Tag className="w-4 h-4" /> Assigned Roles
                </label>
                {editMode ? (
                  <RoleCheckboxes
                    selectedIds={editedPrompt.assigned_role_ids || []}
                    onChange={(id) =>
                      setEditedPrompt((prev) => ({
                        ...prev,
                        assigned_role_ids: (prev.assigned_role_ids || []).includes(id)
                          ? prev.assigned_role_ids.filter((r) => r !== id)
                          : [...(prev.assigned_role_ids || []), id],
                      }))
                    }
                  />
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(selectedPrompt.assigned_roles_info || []).length > 0
                      ? selectedPrompt.assigned_roles_info.map((r) => (
                        <span key={r.id} className="inline-flex flex-col px-3 py-1.5 bg-blue-50 border border-blue-100 text-blue-900 rounded-lg text-sm capitalize">
                          <span className="font-semibold">{r.name}</span>
                          {r.plan_name ? (
                            <span className="text-xs text-emerald-700 font-normal normal-case">
                              {r.plan_name} · {formatTokenLimit(r.token_limit)} tokens
                            </span>
                          ) : (
                            <span className="text-xs text-gray-500 font-normal normal-case">No plan on role</span>
                          )}
                        </span>
                      ))
                      : <span className="text-sm text-gray-400">No roles assigned</span>
                    }
                  </div>
                )}
              </div>

              {/* Solo User IDs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                  <User className="w-4 h-4" /> Solo User IDs
                </label>
                {editMode ? (
                  <input
                    type="text"
                    value={editedPrompt.assigned_user_ids_str || ''}
                    onChange={(e) => setEditedPrompt((prev) => ({ ...prev, assigned_user_ids_str: e.target.value }))}
                    placeholder="e.g. 101, 204, 305"
                    className="w-full max-w-xl px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                ) : (
                  <div className="space-y-2">
                    {(selectedPrompt.assigned_user_ids || []).length > 0 ? (
                      <ul className="space-y-2">
                        {selectedPrompt.assigned_user_ids.map((uid) => {
                          const info = userTokenLimits[uid];
                          return (
                            <li key={uid} className="flex flex-wrap items-center gap-2 text-sm border border-gray-100 rounded-lg px-3 py-2 bg-gray-50">
                              <User className="w-4 h-4 text-gray-400" />
                              <span className="font-medium">User #{uid}</span>
                              {userLimitsLoading && !info ? (
                                <span className="text-xs text-gray-400">Resolving token limit…</span>
                              ) : info?.token_limit != null ? (
                                <span className="text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                                  {formatTokenLimit(info.token_limit)} tokens
                                  {info.plan?.name ? ` (${info.plan.name})` : ''}
                                  {info.source === 'user_subscription' ? ' · from subscription' : ' · from role plan'}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">{info?.message || 'No plan / limit resolved'}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <span className="text-gray-400">No solo users assigned</span>
                    )}
                  </div>
                )}
              </div>

              {/* Prompt Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">System Prompt</label>
                {editMode ? (
                  <textarea
                    value={editedPrompt.system_prompt}
                    onChange={(e) => setEditedPrompt((prev) => ({ ...prev, system_prompt: e.target.value }))}
                    rows={15}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  />
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 font-mono text-sm text-gray-800 whitespace-pre-wrap border">
                    {selectedPrompt.system_prompt}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemPromptManagement;
