

import React, { useState, useEffect } from 'react';
import { Eye, Edit, Save, CreditCard, Filter, ChevronLeft, ChevronRight, Trash2, PlusCircle, X, DollarSign, IndianRupee } from 'lucide-react';
import { API_BASE_URL } from '../../config';

// Custom Sweet Alert Component
const SweetAlert = ({ isOpen, onClose, onConfirm, title, text, type = 'info', showCancel = false }) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return 'ℹ️';
    }
  };

  const getButtonColor = () => {
    switch (type) {
      case 'success': return 'bg-green-600 hover:bg-green-700';
      case 'error': return 'bg-red-600 hover:bg-red-700';
      case 'warning': return 'bg-yellow-600 hover:bg-yellow-700';
      default: return 'bg-blue-600 hover:bg-blue-700';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="text-center">
          <div className="text-4xl mb-4">{getIcon()}</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          {text && <p className="text-gray-600 mb-6">{text}</p>}
          <div className="flex justify-center space-x-3">
            {showCancel && (
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-white rounded-lg ${getButtonColor()}`}
            >
              {showCancel ? 'Confirm' : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// API Service
const apiService = {
  baseURL: `${API_BASE_URL}/admin/plans`,
  
  async fetchPlans() {
    const response = await fetch(this.baseURL);
    if (!response.ok) {
      const errorBody = await response.json();
      throw { status: response.status, message: errorBody.message || `HTTP error! status: ${response.status}` };
    }
    return await response.json();
  },
  
  async createPlan(data) {
    const response = await fetch(this.baseURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorBody = await response.json();
      throw { status: response.status, message: errorBody.message || `HTTP error! status: ${response.status}` };
    }
    return await response.json();
  },
  
  async getPlan(id) {
    const response = await fetch(`${this.baseURL}/${id}`);
    if (!response.ok) {
      const errorBody = await response.json();
      throw { status: response.status, message: errorBody.message || `HTTP error! status: ${response.status}` };
    }
    return await response.json();
  },
  
  async updatePlan(id, data) {
    const response = await fetch(`${this.baseURL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!response.ok) {
      const errorBody = await response.json();
      throw { status: response.status, message: errorBody.message || `HTTP error! status: ${response.status}` };
    }
    return await response.json();
  },
  
  async deletePlan(id) {
    const response = await fetch(`${this.baseURL}/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      const errorBody = await response.json();
      throw { status: response.status, message: errorBody.message || `HTTP error! status: ${response.status}` };
    }
    return { success: true };
  }
};

// Plan Form Component
const PlanForm = ({ plan, onSave, onCancel, loading }) => {
  const [formData, setFormData] = useState(plan || {
    name: '',
    description: '',
    price: '',
    currency: 'INR',
    interval: 'monthly',
    type: 'individual',
    features: '',
    document_limit: '',
    ai_analysis_limit: '',
    template_access: 'basic',
    token_limit: '',
    carry_over_limit: '',
    storage_limit_gb: '', // New field
    drafting_type: 'basic', // New field with default
    razorpay_plan_id: '', // New field
    limits: { summaries: '', drafts: '' }
  });

  const handleChange = (field, value) => {
    if (field.startsWith('limits.')) {
      const limitField = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        limits: { ...prev.limits, [limitField]: value }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSubmit = () => {
    // Basic validation
    if (!formData.name) {
      alert('Plan Name is required.');
      return;
    }
    if (isNaN(parseFloat(formData.price)) || parseFloat(formData.price) <= 0) {
      alert('Price must be a positive number.');
      return;
    }
    if (isNaN(parseInt(formData.document_limit)) || parseInt(formData.document_limit) < 0) {
      alert('Document Limit must be a non-negative number.');
      return;
    }
    if (isNaN(parseInt(formData.ai_analysis_limit)) || parseInt(formData.ai_analysis_limit) < 0) {
      alert('AI Analysis Limit must be a non-negative number.');
      return;
    }
    if (isNaN(parseInt(formData.storage_limit_gb)) || parseInt(formData.storage_limit_gb) < 0) {
      alert('Storage Limit (GB) must be a non-negative number.');
      return;
    }
    if (!formData.razorpay_plan_id) {
      alert('Razorpay Plan ID is required.');
      return;
    }

    const data = {
      ...formData,
      price: parseFloat(formData.price),
      document_limit: parseInt(formData.document_limit),
      ai_analysis_limit: parseInt(formData.ai_analysis_limit),
      token_limit: parseInt(formData.token_limit || '0'), // Optional, so default to 0 if empty
      carry_over_limit: parseInt(formData.carry_over_limit || '0'), // Optional, so default to 0 if empty
      storage_limit_gb: parseInt(formData.storage_limit_gb),
      drafting_type: formData.drafting_type,
      razorpay_plan_id: formData.razorpay_plan_id,
      limits: {
        summaries: parseInt(formData.limits.summaries || '0'), // Optional
        drafts: parseInt(formData.limits.drafts || '0') // Optional
      }
    };
    onSave(data);
  };

  return (
    <div className="bg-white p-6">
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <h2 className="text-2xl font-semibold flex items-center">
          <PlusCircle className="mr-3" />
          {plan ? 'Edit Plan' : 'Create New Plan'}
        </h2>
        <button onClick={onCancel} className="p-2 hover:bg-gray-100 rounded-lg">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <h4 className="font-medium border-b pb-2">Basic Information</h4>
          
          <div>
            <label className="block text-sm font-medium mb-1">Plan Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Basic, Pro, Enterprise"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Plan description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Price *</label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => handleChange('price', e.target.value)}
                className="w-full pl-10 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            <select
              value={formData.currency}
              onChange={(e) => handleChange('currency', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="INR">INR</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Interval</label>
            <select
              value={formData.interval}
              onChange={(e) => handleChange('interval', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={formData.type}
              onChange={(e) => handleChange('type', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="individual">Individual</option>
              <option value="business">Business</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Features</label>
            <textarea
              value={formData.features}
              onChange={(e) => handleChange('features', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="List of features"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Storage Limit (GB) *</label>
            <input
              type="number"
              value={formData.storage_limit_gb}
              onChange={(e) => handleChange('storage_limit_gb', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 10, 50, 100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Drafting Type</label>
            <select
              value={formData.drafting_type}
              onChange={(e) => handleChange('drafting_type', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="basic">Basic</option>
              <option value="premium">Premium</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Razorpay Plan ID *</label>
            <input
              type="text"
              value={formData.razorpay_plan_id}
              onChange={(e) => handleChange('razorpay_plan_id', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., plan_Abcdef123456"
            />
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <h4 className="font-medium border-b pb-2">Limits & Access</h4>

          <div>
            <label className="block text-sm font-medium mb-1">Document Limit *</label>
            <input
              type="number"
              value={formData.document_limit}
              onChange={(e) => handleChange('document_limit', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Number of documents"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">AI Analysis Limit *</label>
            <input
              type="number"
              value={formData.ai_analysis_limit}
              onChange={(e) => handleChange('ai_analysis_limit', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Number of AI analyses"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Template Access</label>
            <select
              value={formData.template_access}
              onChange={(e) => handleChange('template_access', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="basic">Basic</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Token Limit *</label>
            <input
              type="number"
              value={formData.token_limit}
              onChange={(e) => handleChange('token_limit', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Number of tokens"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Carry Over Limit</label>
            <input
              type="number"
              value={formData.carry_over_limit}
              onChange={(e) => handleChange('carry_over_limit', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Carry over limit"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Summaries Limit</label>
            <input
              type="number"
              value={formData.limits.summaries}
              onChange={(e) => handleChange('limits.summaries', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Number of summaries"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Drafts Limit</label>
            <input
              type="number"
              value={formData.limits.drafts}
              onChange={(e) => handleChange('limits.drafts', e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Number of drafts"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 pt-6 border-t flex justify-end space-x-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
        >
          {loading ? 'Saving...' : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save Plan
            </>
          )}
        </button>
      </div>
    </div>
  );
};

// Plan Details Component
const PlanDetails = ({ plan, onEdit, onBack, onSave, editMode, loading }) => {
  const [editData, setEditData] = useState(plan);

  useEffect(() => {
    if (plan) {
      setEditData({
        ...plan,
        storage_limit_gb: plan.storage_limit_gb || '',
        drafting_type: plan.drafting_type || 'basic',
        razorpay_plan_id: plan.razorpay_plan_id || '',
        limits: plan.limits || { summaries: '', drafts: '' }
      });
    }
  }, [plan]);

  const handleChange = (field, value) => {
    if (field.startsWith('limits.')) {
      const limitField = field.split('.')[1];
      setEditData(prev => ({
        ...prev,
        limits: { ...prev.limits, [limitField]: value }
      }));
    } else {
      setEditData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleSave = () => {
    if (!editData || !editData.id) {
      alert('Plan ID is missing. Please refresh and try again.');
      return;
    }

    // Basic validation for edit mode
    if (!editData.name) {
      alert('Plan Name is required.');
      return;
    }
    if (isNaN(parseFloat(editData.price)) || parseFloat(editData.price) <= 0) {
      alert('Price must be a positive number.');
      return;
    }
    if (isNaN(parseInt(editData.document_limit)) || parseInt(editData.document_limit) < 0) {
      alert('Document Limit must be a non-negative number.');
      return;
    }
    if (isNaN(parseInt(editData.ai_analysis_limit)) || parseInt(editData.ai_analysis_limit) < 0) {
      alert('AI Analysis Limit must be a non-negative number.');
      return;
    }
    if (isNaN(parseInt(editData.storage_limit_gb)) || parseInt(editData.storage_limit_gb) < 0) {
      alert('Storage Limit (GB) must be a non-negative number.');
      return;
    }
    if (!editData.razorpay_plan_id) {
      alert('Razorpay Plan ID is required.');
      return;
    }

    const data = {
      ...editData,
      price: parseFloat(editData.price) || 0,
      document_limit: parseInt(editData.document_limit || '0'),
      ai_analysis_limit: parseInt(editData.ai_analysis_limit || '0'),
      token_limit: parseInt(editData.token_limit || '0'),
      carry_over_limit: parseInt(editData.carry_over_limit || '0'),
      storage_limit_gb: parseInt(editData.storage_limit_gb || '0'), // New field
      drafting_type: editData.drafting_type, // New field
      razorpay_plan_id: editData.razorpay_plan_id, // New field
      limits: {
        summaries: parseInt(editData.limits?.summaries || '0'),
        drafts: parseInt(editData.limits?.drafts || '0')
      }
    };
    onSave(data);
  };

  if (!plan) return null;

  return (
    <div className="bg-white">
      <div className="flex items-center justify-between mb-6 pb-4 border-b">
        <h2 className="text-2xl font-semibold flex items-center">
          <CreditCard className="mr-3" />
          Plan Details
        </h2>
        <div className="flex space-x-2">
          <button onClick={onBack} className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            Back to List
          </button>
          {editMode ? (
            <>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center"
              >
                {loading ? 'Saving...' : <><Save className="w-4 h-4 mr-1" />Save</>}
              </button>
              <button onClick={() => onEdit(false)} className="px-4 py-2 border rounded-lg">
                Cancel
              </button>
            </>
          ) : (
            <button onClick={() => onEdit(true)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center">
              <Edit className="w-4 h-4 mr-1" />Edit
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-4">
          <h4 className="font-medium border-b pb-2">Basic Information</h4>
          
          <div>
            <label className="block text-sm font-medium mb-1">Plan ID</label>
            <span className="text-sm">#{plan.id}</span>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            {editMode ? (
              <input
                type="text"
                value={editData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            ) : (
              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                plan.name === 'Basic' ? 'bg-blue-50 text-blue-600' :
                plan.name === 'Pro' ? 'bg-green-50 text-green-600' :
                plan.name === 'Enterprise' ? 'bg-purple-50 text-purple-600' :
                'bg-gray-50 text-gray-600'
              }`}>
                {plan.name}
              </span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            {editMode ? (
              <textarea
                value={editData.description || ''}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg"
              />
            ) : (
              <p className="text-sm">{plan.description || 'No description'}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Price</label>
            {editMode ? (
              <div className="relative">
                <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="number"
                  step="0.01"
                  value={editData.price}
                  onChange={(e) => handleChange('price', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border rounded-lg"
                />
              </div>
            ) : (
              <div className="flex items-center">
                <IndianRupee className="w-4 h-4 mr-1" />
                {typeof plan.price === 'number' ? plan.price.toFixed(2) : parseFloat(plan.price)?.toFixed(2)}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Currency</label>
            {editMode ? (
              <select
                value={editData.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            ) : (
              <span className="text-sm">{plan.currency}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            {editMode ? (
              <select
                value={editData.type}
                onChange={(e) => handleChange('type', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="individual">Individual</option>
                <option value="business">Business</option>
                <option value="enterprise">Enterprise</option>
              </select>
            ) : (
              <span className="text-sm capitalize">{plan.type}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Interval</label>
            {editMode ? (
              <select
                value={editData.interval}
                onChange={(e) => handleChange('interval', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            ) : (
              <span className="text-sm capitalize">{plan.interval}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Features</label>
            {editMode ? (
              <textarea
                value={editData.features}
                onChange={(e) => handleChange('features', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border rounded-lg"
              />
            ) : (
              <p className="text-sm bg-gray-50 rounded p-3">{plan.features || 'No features listed'}</p>
            )}
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          <h4 className="font-medium border-b pb-2">Limits & Access</h4>
          
          <div>
            <label className="block text-sm font-medium mb-1">Document Limit</label>
            {editMode ? (
              <input
                type="number"
                value={editData.document_limit || ''}
                onChange={(e) => handleChange('document_limit', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            ) : (
              <span className="text-sm">{plan.document_limit || 'N/A'}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">AI Analysis Limit</label>
            {editMode ? (
              <input
                type="number"
                value={editData.ai_analysis_limit || ''}
                onChange={(e) => handleChange('ai_analysis_limit', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            ) : (
              <span className="text-sm">{plan.ai_analysis_limit || 'N/A'}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Storage Limit (GB)</label>
            {editMode ? (
              <input
                type="number"
                value={editData.storage_limit_gb || ''}
                onChange={(e) => handleChange('storage_limit_gb', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            ) : (
              <span className="text-sm">{plan.storage_limit_gb || 'N/A'}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Drafting Type</label>
            {editMode ? (
              <select
                value={editData.drafting_type}
                onChange={(e) => handleChange('drafting_type', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
              </select>
            ) : (
              <span className="text-sm capitalize">{plan.drafting_type || 'N/A'}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Razorpay Plan ID</label>
            {editMode ? (
              <input
                type="text"
                value={editData.razorpay_plan_id || ''}
                onChange={(e) => handleChange('razorpay_plan_id', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            ) : (
              <span className="text-sm">{plan.razorpay_plan_id || 'N/A'}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Template Access</label>
            {editMode ? (
              <select
                value={editData.template_access}
                onChange={(e) => handleChange('template_access', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="basic">Basic</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
            ) : (
              <span className="text-sm capitalize">{plan.template_access || 'N/A'}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Token Limit</label>
            {editMode ? (
              <input
                type="number"
                value={editData.token_limit || ''}
                onChange={(e) => handleChange('token_limit', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            ) : (
              <span className="text-sm">{plan.token_limit || 'N/A'}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Carry Over Limit</label>
            {editMode ? (
              <input
                type="number"
                value={editData.carry_over_limit || ''}
                onChange={(e) => handleChange('carry_over_limit', e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            ) : (
              <span className="text-sm">{plan.carry_over_limit || 'N/A'}</span>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Additional Limits</label>
            <div className="bg-gray-50 rounded p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Summaries:</span>
                {editMode ? (
                  <input
                    type="number"
                    value={editData.limits?.summaries || ''}
                    onChange={(e) => handleChange('limits.summaries', e.target.value)}
                    className="w-20 px-2 py-1 border rounded text-xs"
                  />
                ) : (
                  <span>{plan.limits?.summaries || 'N/A'}</span>
                )}
              </div>
              <div className="flex justify-between text-sm">
                <span>Drafts:</span>
                {editMode ? (
                  <input
                    type="number"
                    value={editData.limits?.drafts || ''}
                    onChange={(e) => handleChange('limits.drafts', e.target.value)}
                    className="w-20 px-2 py-1 border rounded text-xs"
                  />
                ) : (
                  <span>{plan.limits?.drafts || 'N/A'}</span>
                )}
              </div>
            </div>
          </div>

          {plan.created_at && (
            <div>
              <label className="block text-sm font-medium mb-1">Created At</label>
              <span className="text-sm">{new Date(plan.created_at).toLocaleDateString()}</span>
            </div>
          )}

          {plan.updated_at && (
            <div>
              <label className="block text-sm font-medium mb-1">Updated At</label>
              <span className="text-sm">{new Date(plan.updated_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main Component
const SubscriptionManagement = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState('list');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [apiLoading, setApiLoading] = useState(false);
  
  // Sweet Alert State
  const [alert, setAlert] = useState({
    isOpen: false,
    title: '',
    text: '',
    type: 'info',
    showCancel: false,
    onConfirm: () => {}
  });

  const itemsPerPage = 5;

  const showAlert = (config) => {
    setAlert({
      isOpen: true,
      onConfirm: () => {
        config.onConfirm?.();
        setAlert(prev => ({ ...prev, isOpen: false }));
      },
      ...config
    });
  };

  const closeAlert = () => {
    setAlert(prev => ({ ...prev, isOpen: false }));
  };

  // Load plans
  const loadPlans = async () => {
    setLoading(true);
    try {
      const response = await apiService.fetchPlans();
      // Handle different response structures
      const plansData = response.data || response;
      setPlans(Array.isArray(plansData) ? plansData : []);
    } catch (error) {
      showAlert({
        type: 'error',
        title: 'Error',
        text: 'Failed to load plans'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  // Create plan
  const handleCreate = async (data) => {
    setApiLoading(true);
    try {
      await apiService.createPlan(data);
      showAlert({
        type: 'success',
        title: 'Success!',
        text: 'Plan created successfully'
      });
      setCurrentView('list');
      loadPlans();
    } catch (error) {
      let errorMessage = 'Failed to create plan';
      if (error.status === 409) {
        errorMessage = 'A plan with this name or Razorpay Plan ID already exists.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      showAlert({
        type: 'error',
        title: 'Error',
        text: errorMessage
      });
    } finally {
      setApiLoading(false);
    }
  };

  // View plan details
  const handleView = async (plan) => {
    try {
      const response = await apiService.getPlan(plan.id);
      // Handle different response structures
      const planData = response.data || response;
      setSelectedPlan(planData);
      setCurrentView('details');
      setEditMode(false);
    } catch (error) {
      showAlert({
        type: 'error',
        title: 'Error',
        text: 'Failed to load plan details'
      });
    }
  };

  // Update plan
  const handleUpdate = async (data) => {
    if (!selectedPlan || !selectedPlan.id) {
      showAlert({
        type: 'error',
        title: 'Error',
        text: 'Plan ID is missing. Please refresh and try again.'
      });
      return;
    }

    setApiLoading(true);
    try {
      await apiService.updatePlan(selectedPlan.id, data);
      showAlert({
        type: 'success',
        title: 'Success!',
        text: 'Plan updated successfully'
      });
      setEditMode(false);
      loadPlans();
      // Refresh current plan
      const response = await apiService.getPlan(selectedPlan.id);
      const planData = response.data || response;
      setSelectedPlan(planData);
    } catch (error) {
      let errorMessage = 'Failed to update plan';
      if (error.status === 409) {
        errorMessage = 'A plan with this name or Razorpay Plan ID already exists.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      showAlert({
        type: 'error',
        title: 'Error',
        text: errorMessage
      });
    } finally {
      setApiLoading(false);
    }
  };

  // Delete plan
  const handleDelete = (plan) => {
    showAlert({
      type: 'warning',
      title: 'Are you sure?',
      text: `This will permanently delete "${plan.name}" plan.`,
      showCancel: true,
      onConfirm: async () => {
        setApiLoading(true);
        try {
          await apiService.deletePlan(plan.id);
          showAlert({
            type: 'success',
            title: 'Deleted!',
            text: 'Plan deleted successfully'
          });
          loadPlans();
        } catch (error) {
          showAlert({
            type: 'error',
            title: 'Error',
            text: 'Failed to delete plan'
          });
        } finally {
          setApiLoading(false);
        }
      }
    });
  };

  // Filter and paginate
  const filteredPlans = plans.filter(plan =>
    plan.name?.toLowerCase().includes(search.toLowerCase()) ||
    plan.description?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredPlans.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPlans = filteredPlans.slice(startIndex, startIndex + itemsPerPage);

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-xl shadow-lg">
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">Loading plans...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-xl shadow-lg">
      <SweetAlert {...alert} onClose={closeAlert} />
      
      {currentView === 'create' && (
        <PlanForm
          onSave={handleCreate}
          onCancel={() => setCurrentView('list')}
          loading={apiLoading}
        />
      )}

      {currentView === 'details' && (
        <PlanDetails
          plan={selectedPlan}
          onEdit={setEditMode}
          onBack={() => setCurrentView('list')}
          onSave={handleUpdate}
          editMode={editMode}
          loading={apiLoading}
        />
      )}

      {currentView === 'list' && (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold flex items-center">
              <CreditCard className="mr-3" />
              Subscription Management
            </h2>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="w-5 h-5 text-gray-600" />
                <input
                  type="text"
                  placeholder="Search plans..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={() => setCurrentView('create')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                Add Plan
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full bg-white border rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Interval</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Doc Limit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">AI Limit</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Storage (GB)</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Drafting Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Razorpay ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {paginatedPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">#{plan.id}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        plan.name === 'Basic' ? 'bg-blue-50 text-blue-600' :
                        plan.name === 'Pro' ? 'bg-green-50 text-green-600' :
                        plan.name === 'Enterprise' ? 'bg-purple-50 text-purple-600' :
                        'bg-gray-50 text-gray-600'
                      }`}>
                        {plan.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm flex items-center">
                      <IndianRupee className="w-4 h-4 mr-1" />
                      {typeof plan.price === 'number' ? plan.price.toFixed(2) : parseFloat(plan.price)?.toFixed(2)}
                      <span className="ml-1 text-xs text-gray-500">{plan.currency}</span>
                    </td>
                    <td className="px-4 py-3 text-sm capitalize">{plan.type}</td>
                    <td className="px-4 py-3 text-sm capitalize">{plan.interval}</td>
                    <td className="px-4 py-3 text-sm">{plan.document_limit || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm">{plan.ai_analysis_limit || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm">{plan.storage_limit_gb || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm capitalize">{plan.drafting_type || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm">{plan.razorpay_plan_id || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleView(plan)}
                          className="p-1 border rounded hover:bg-gray-50"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(plan)}
                          className="p-1 border border-red-300 text-red-600 rounded hover:bg-red-50"
                          disabled={apiLoading}
                          title="Delete Plan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedPlans.length === 0 && (
                  <tr>
                    <td colSpan="11" className="px-4 py-8 text-center text-gray-500">
                      No plans found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filteredPlans.length > 0 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-gray-700">
                Showing {startIndex + 1} to {Math.min(startIndex + itemsPerPage, filteredPlans.length)} of {filteredPlans.length} entries
              </div>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`flex items-center px-3 py-2 text-sm border rounded-lg ${
                    currentPage === 1
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Previous
                </button>
                
                <div className="flex space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`px-3 py-2 text-sm border rounded-lg ${
                        currentPage === page
                          ? 'bg-blue-50 border-blue-500 text-blue-600'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`flex items-center px-3 py-2 text-sm border rounded-lg ${
                    currentPage === totalPages
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SubscriptionManagement;