import React, { useState, useEffect, useCallback } from 'react';
import { PlusCircle, Trash2, Edit, Save, X, Shield, CreditCard, Tag } from 'lucide-react';
import axios from 'axios';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import { API_BASE_URL } from '../../config';

const MySwal = withReactContent(Swal);
const APP_ROLES_API_URL = `${API_BASE_URL}/app-roles`;
const PROMPT_ROLES_API_URL = `${API_BASE_URL}/prompt-roles`;
const PLANS_API_URL = `${API_BASE_URL}/admin/plans`;

const formatTokenLimit = (n) => {
  if (n == null || n === '') return '—';
  const num = Number(n);
  return Number.isNaN(num) ? '—' : num.toLocaleString();
};

const RoleManagement = () => {
  const [activeTab, setActiveTab] = useState('prompt');

  const [appRoles, setAppRoles] = useState([]);
  const [promptRoles, setPromptRoles] = useState([]);
  const [plans, setPlans] = useState([]);

  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', plan_id: '' });
  const [saving, setSaving] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState({});

  const getToken = () => localStorage.getItem('token') || sessionStorage.getItem('token');
  const authHeaders = () => ({ Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' });

  const fetchPlans = useCallback(async () => {
    try {
      const res = await axios.get(PLANS_API_URL, { headers: authHeaders() });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setPlans(res.data.data);
      } else if (Array.isArray(res.data)) {
        setPlans(res.data);
      }
    } catch {
      setPlans([]);
    }
  }, []);

  const fetchAppRoles = useCallback(async () => {
    const res = await axios.get(APP_ROLES_API_URL, { headers: authHeaders() });
    if (res.data.success) setAppRoles(res.data.data);
  }, []);

  const fetchPromptRoles = useCallback(async () => {
    const res = await axios.get(PROMPT_ROLES_API_URL, { headers: authHeaders() });
    if (res.data.success) setPromptRoles(res.data.data);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([fetchPlans(), fetchAppRoles(), fetchPromptRoles()]);
    } catch (err) {
      MySwal.fire({
        icon: 'error',
        title: 'Error',
        text: err.response?.data?.message || 'Failed to load roles.',
        confirmButtonColor: '#3085d6',
      });
    } finally {
      setLoading(false);
    }
  }, [fetchPlans, fetchAppRoles, fetchPromptRoles]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const isPromptTab = activeTab === 'prompt';
  const roles = isPromptTab ? promptRoles : appRoles;
  const apiBase = isPromptTab ? PROMPT_ROLES_API_URL : APP_ROLES_API_URL;

  const openCreate = () => {
    setEditingRole(null);
    setFormData({ name: '', description: '', plan_id: '' });
    setShowForm(true);
  };

  const openEdit = (role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      plan_id: role.plan_id != null ? String(role.plan_id) : '',
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRole(null);
    setFormData({ name: '', description: '', plan_id: '' });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      MySwal.fire({ icon: 'warning', title: 'Validation', text: 'Role name is required.', confirmButtonColor: '#3085d6' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        description: formData.description?.trim() || null,
      };
      if (isPromptTab) {
        payload.plan_id = formData.plan_id ? parseInt(formData.plan_id, 10) : null;
      }

      if (editingRole) {
        await axios.put(`${apiBase}/${editingRole.id}`, payload, { headers: authHeaders() });
        MySwal.fire({ icon: 'success', title: 'Updated!', text: 'Role updated successfully.', confirmButtonColor: '#3085d6', timer: 2000 });
      } else {
        await axios.post(apiBase, payload, { headers: authHeaders() });
        MySwal.fire({ icon: 'success', title: 'Created!', text: 'Role created successfully.', confirmButtonColor: '#3085d6', timer: 2000 });
      }
      closeForm();
      if (isPromptTab) await fetchPromptRoles();
      else await fetchAppRoles();
    } catch (err) {
      MySwal.fire({ icon: 'error', title: 'Error', text: err.response?.data?.message || 'Failed to save role.', confirmButtonColor: '#3085d6' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role) => {
    if (!isPromptTab && role.is_system) {
      MySwal.fire({ icon: 'warning', title: 'Cannot delete', text: `"${role.name}" is a system role and cannot be deleted.`, confirmButtonColor: '#3085d6' });
      return;
    }
    const result = await MySwal.fire({
      title: `Delete "${role.name}"?`,
      text: 'This role will be permanently removed.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, delete',
    });
    if (!result.isConfirmed) return;

    setDeleteLoading((p) => ({ ...p, [role.id]: true }));
    try {
      const res = await axios.delete(`${apiBase}/${role.id}`, { headers: authHeaders() });
      if (!res.data?.success) throw new Error(res.data?.message || 'Delete did not complete.');
      if (isPromptTab) setPromptRoles((prev) => prev.filter((r) => r.id !== role.id));
      else setAppRoles((prev) => prev.filter((r) => r.id !== role.id));
      MySwal.fire({ icon: 'success', title: 'Deleted!', text: `"${role.name}" was removed.`, timer: 2000, confirmButtonColor: '#3085d6' });
    } catch (err) {
      MySwal.fire({ icon: 'error', title: 'Cannot delete role', text: err.response?.data?.message || err.message, confirmButtonColor: '#3085d6' });
      fetchAll();
    } finally {
      setDeleteLoading((p) => ({ ...p, [role.id]: false }));
    }
  };

  const planLabel = (planId) => {
    if (!planId) return null;
    const p = plans.find((x) => x.id === planId) || null;
    return p ? `${p.name} (${formatTokenLimit(p.token_limit)} tokens)` : `Plan #${planId}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                <Shield className="mr-3 text-gray-800" size={32} />
                Role Management
              </h1>
              <p className="text-gray-600 mt-1">
                Application roles for template prompts &middot; Prompt roles for system prompts with subscription plans
              </p>
            </div>
            <button
              onClick={openCreate}
              className="inline-flex items-center px-4 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all"
            >
              <PlusCircle className="w-5 h-5 mr-2" />
              Add {isPromptTab ? 'Prompt' : 'App'} Role
            </button>
          </div>

          <div className="flex gap-2 mt-6 border-b border-gray-200">
            <button
              type="button"
              onClick={() => { setActiveTab('prompt'); closeForm(); }}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                isPromptTab ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Tag className="w-4 h-4 inline mr-1.5" />
              Prompt Roles (system prompts)
            </button>
            <button
              type="button"
              onClick={() => { setActiveTab('app'); closeForm(); }}
              className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                !isPromptTab ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Application Roles (template prompts)
            </button>
          </div>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {editingRole ? 'Edit Role' : `Create New ${isPromptTab ? 'Prompt' : 'Application'} Role`}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X size={22} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={isPromptTab ? 'e.g. insurance, compliance' : 'e.g. Trainee, Partner'}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              {isPromptTab && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                    <CreditCard className="w-4 h-4" />
                    Subscription Plan <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <select
                    value={formData.plan_id}
                    onChange={(e) => setFormData({ ...formData, plan_id: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm bg-white"
                  >
                    <option value="">— No plan (no token limit from role) —</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatTokenLimit(p.token_limit)} tokens ({p.type}, {p.interval})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Plans are loaded from the payment service. Users on a subscription get that plan&apos;s token limit;
                    otherwise the role&apos;s attached plan applies.
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-all"
              >
                {saving ? 'Saving...' : <><Save className="w-4 h-4 mr-2" />{editingRole ? 'Update Role' : 'Create Role'}</>}
              </button>
              <button onClick={closeForm} className="px-5 py-2.5 border border-gray-300 text-sm font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-all">
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {loading ? (
            <div className="py-16 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading roles...</p>
            </div>
          ) : roles.length === 0 ? (
            <div className="py-16 text-center">
              <Shield className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No roles found</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    'Name',
                    'Description',
                    ...(isPromptTab ? ['Plan / Token Limit'] : ['Type']),
                    'Created',
                    'Actions',
                  ].map((h) => (
                    <th key={h} className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {roles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 capitalize">
                        {role.name}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{role.description || <span className="text-gray-400">—</span>}</td>
                    {isPromptTab ? (
                      <td className="px-6 py-4 text-sm">
                        {role.plan_info ? (
                          <span className="inline-flex flex-col gap-0.5">
                            <span className="font-medium text-emerald-800">{role.plan_info.name}</span>
                            <span className="text-xs text-emerald-700">{formatTokenLimit(role.plan_info.token_limit)} tokens</span>
                          </span>
                        ) : role.plan_id ? (
                          <span className="text-amber-700 text-xs">{planLabel(role.plan_id)}</span>
                        ) : (
                          <span className="text-gray-400">No plan</span>
                        )}
                      </td>
                    ) : (
                      <td className="px-6 py-4">
                        {role.is_system ? (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-medium">System</span>
                        ) : (
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">Custom</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-4 text-sm text-gray-500">{new Date(role.created_at).toLocaleDateString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(role)}
                          disabled={!isPromptTab && role.is_system}
                          title={!isPromptTab && role.is_system ? 'System roles cannot be edited' : 'Edit'}
                          className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-xs font-semibold rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(role)}
                          disabled={deleteLoading[role.id] || (!isPromptTab && role.is_system)}
                          className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-semibold rounded-lg text-white bg-red-600 hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {deleteLoading[role.id] ? <div className="animate-spin h-4 w-4 border-2 border-white border-b-transparent rounded-full"></div> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="bg-gray-50 px-6 py-3 border-t text-xs text-gray-500">
            {roles.length} {isPromptTab ? 'prompt' : 'application'} role{roles.length !== 1 ? 's' : ''}
            {isPromptTab && ' — attach subscription plans for token limits used in System Prompt Management'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoleManagement;
