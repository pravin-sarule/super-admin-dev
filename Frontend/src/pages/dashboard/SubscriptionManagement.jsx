import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, Plus, Edit2, Trash2, X, Check, AlertTriangle,
  MessageSquare, BookOpen, Search, RefreshCw, ChevronUp, ChevronDown,
  Clock, Users, BarChart2, FileText, Upload, Hash, Activity, DollarSign,
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../config';

/* ─── Toast ─── */
const Toast = ({ toasts, remove }) => (
  <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
    {toasts.map((t) => (
      <div key={t.id}
        className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium min-w-[280px] max-w-xs animate-slide-in-right
          ${t.type === 'success' ? 'bg-white border-emerald-200 text-emerald-800' :
            t.type === 'error'   ? 'bg-white border-red-200   text-red-800'   :
            'bg-white border-amber-200 text-amber-800'}`}
      >
        <span className="mt-0.5 text-base">{t.type === 'success' ? '✅' : t.type === 'error' ? '❌' : '⚠️'}</span>
        <p className="flex-1 leading-snug">{t.message}</p>
        <button onClick={() => remove(t.id)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
      </div>
    ))}
  </div>
);

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);
  const remove = useCallback((id) => setToasts((p) => p.filter((t) => t.id !== id)), []);
  return { toasts, add, remove };
}

/* ─── Delete confirm modal ─── */
const DeleteModal = ({ plan, onClose, onConfirm, loading }) => {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center"
        style={{ animation: 'modalIn 0.2s ease-out' }}>
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-base font-semibold text-slate-800 mb-1">Delete Plan</h3>
        <p className="text-sm text-slate-500 mb-5">
          Delete <span className="font-semibold text-slate-700">"{plan?.name}"</span>? This cannot be undone.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={onClose} disabled={loading}
            className="px-5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={loading}
            className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors">
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Number input field ─── */
const NumField = ({ label, hint, value, onChange, placeholder }) => (
  <div>
    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
    <input
      type="number" min="0"
      value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? '—'}
      className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 hover:border-slate-300 transition-all"
    />
    {hint && <p className="text-xs text-slate-400 mt-0.5">{hint}</p>}
  </div>
);

/* ─── Section header inside drawer ─── */
const DrawerSection = ({ icon: Icon, color, title, children }) => (
  <div className={`rounded-xl border ${color.cardBorder} overflow-hidden`}>
    <div className={`flex items-center gap-2.5 px-4 py-3 border-b ${color.border} ${color.headerBg}`}>
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color.bg}`}>
        <Icon className={`w-4 h-4 ${color.icon}`} />
      </div>
      <h4 className={`text-sm font-semibold ${color.text}`}>{title}</h4>
    </div>
    <div className="grid grid-cols-2 gap-3 p-4 bg-white">{children}</div>
  </div>
);

/* ─── Default form values ─── */
const PLAN_TYPES = [
  { value: 'individual', label: 'Individual', color: 'bg-blue-50 text-blue-700 border-blue-100' },
  { value: 'enterprise', label: 'Enterprise', color: 'bg-violet-50 text-violet-700 border-violet-100' },
  { value: 'team',       label: 'Team',       color: 'bg-amber-50 text-amber-700 border-amber-100' },
  { value: 'business',   label: 'Business',   color: 'bg-emerald-50 text-emerald-700 border-emerald-100' },
];

const planTypeColor = (type) =>
  PLAN_TYPES.find((t) => t.value === type)?.color || 'bg-slate-50 text-slate-600 border-slate-200';

const EMPTY_FORM = {
  name: '',
  type: 'individual',
  price: '',
  currency: 'INR',
  interval: 'month',
  // Chat
  chat_token_limit: '',          chat_messages_per_hour: '50',
  chat_chats_per_day: '60',      chat_quota_per_minute: '10',
  chat_max_document_pages: '300', chat_max_document_size_mb: '40',
  chat_max_file_upload_per_day: '15', chat_max_upload_files: '8',
  // Summarization
  summarization_token_limit: '',  sum_messages_per_hour: '60',
  sum_chats_per_day: '80',        sum_quota_per_minute: '20',
  sum_max_document_pages: '400',  sum_max_document_size_mb: '40',
  sum_max_file_upload_per_day: '15', sum_max_upload_files: '10',
  sum_max_context_documents: '8',    sum_max_conversation_history: '25',
};

function planToForm(plan) {
  const f = {};
  Object.keys(EMPTY_FORM).forEach((k) => {
    f[k] = plan[k] != null ? String(plan[k]) : '';
  });
  if (!f.type)     f.type     = 'individual';
  if (!f.currency) f.currency = 'INR';
  if (!f.interval) f.interval = 'month';
  return f;
}

/* ─── Plan Drawer ─── */
const PlanDrawer = ({ isOpen, mode, plan, onClose, onSubmit, saving }) => {
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    if (!isOpen) return;
    setForm(mode === 'edit' && plan ? planToForm(plan) : { ...EMPTY_FORM });
  }, [isOpen, mode, plan]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const isEdit = mode === 'edit';

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm"
        style={{ animation: 'fadeIn 0.18s ease-out' }}
        onClick={onClose} />

      {/* Drawer panel */}
      <div className="fixed right-0 top-0 h-full z-[110] w-full max-w-2xl bg-white shadow-2xl flex flex-col"
        style={{ animation: 'slideInRight 0.22s cubic-bezier(0.22,1,0.36,1)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50">
              {isEdit
                ? <Edit2 className="w-4 h-4 text-blue-600" />
                : <Plus className="w-4 h-4 text-blue-600" />}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">
                {isEdit ? `Edit Plan — ${plan?.name}` : 'Add New Plan'}
              </h3>
              <p className="text-xs text-slate-400">Configure all service limits for this plan</p>
            </div>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <form id="plan-form" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Plan name */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Plan Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text" value={form.name} onChange={(e) => set('name')(e.target.value)}
              placeholder="e.g. Basic, Pro, Enterprise" required
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 hover:border-slate-300 transition-all"
            />
          </div>

          {/* Pricing */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 bg-slate-50">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-violet-50">
                <DollarSign className="w-4 h-4 text-violet-600" />
              </div>
              <h4 className="text-sm font-semibold text-slate-700">Pricing</h4>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-white">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Plan Type</label>
                <select value={form.type} onChange={(e) => set('type')(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 hover:border-slate-300 transition-all appearance-none">
                  {PLAN_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Price <span className="text-red-500">*</span>
                </label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.price} onChange={(e) => set('price')(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 hover:border-slate-300 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Currency</label>
                <select value={form.currency} onChange={(e) => set('currency')(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 hover:border-slate-300 transition-all appearance-none">
                  <option value="INR">INR ₹</option>
                  <option value="USD">USD $</option>
                  <option value="EUR">EUR €</option>
                  <option value="GBP">GBP £</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Billing Cycle</label>
                <select value={form.interval} onChange={(e) => set('interval')(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 hover:border-slate-300 transition-all appearance-none">
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                  <option value="quarter">Quarterly</option>
                </select>
              </div>
            </div>
          </div>

          {/* Chat Model Limits */}
          <DrawerSection
            icon={MessageSquare}
            color={{ bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-800', border: 'border-blue-100', cardBorder: 'border-blue-100', headerBg: 'bg-blue-50/60' }}
            title="Chat Model Limits"
          >
            <NumField label="Tokens / Day"         placeholder="e.g. 50000"  value={form.chat_token_limit}           onChange={set('chat_token_limit')} />
            <NumField label="Messages / Hour"       placeholder="50"          value={form.chat_messages_per_hour}     onChange={set('chat_messages_per_hour')} />
            <NumField label="Chats / Day"           placeholder="60"          value={form.chat_chats_per_day}         onChange={set('chat_chats_per_day')} />
            <NumField label="Quota / Minute"        placeholder="10"          value={form.chat_quota_per_minute}      onChange={set('chat_quota_per_minute')} />
            <NumField label="Max Doc Pages"         placeholder="300"         value={form.chat_max_document_pages}    onChange={set('chat_max_document_pages')} />
            <NumField label="Max Doc Size (MB)"     placeholder="40"          value={form.chat_max_document_size_mb}  onChange={set('chat_max_document_size_mb')} />
            <NumField label="Max Uploads / Day"     placeholder="15"          value={form.chat_max_file_upload_per_day} onChange={set('chat_max_file_upload_per_day')} />
            <NumField label="Max Files / Request"   placeholder="8"           value={form.chat_max_upload_files}      onChange={set('chat_max_upload_files')} />
          </DrawerSection>

          {/* Summarization Limits */}
          <DrawerSection
            icon={BookOpen}
            color={{ bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-800', border: 'border-emerald-100', cardBorder: 'border-emerald-100', headerBg: 'bg-emerald-50/60' }}
            title="Summarization Limits"
          >
            <NumField label="Tokens / Day"            placeholder="e.g. 100000"  value={form.summarization_token_limit}    onChange={set('summarization_token_limit')} />
            <NumField label="Messages / Hour"          placeholder="60"           value={form.sum_messages_per_hour}        onChange={set('sum_messages_per_hour')} />
            <NumField label="Chats / Day"              placeholder="80"           value={form.sum_chats_per_day}            onChange={set('sum_chats_per_day')} />
            <NumField label="Quota / Minute"           placeholder="20"           value={form.sum_quota_per_minute}         onChange={set('sum_quota_per_minute')} />
            <NumField label="Max Doc Pages"            placeholder="400"          value={form.sum_max_document_pages}       onChange={set('sum_max_document_pages')} />
            <NumField label="Max Doc Size (MB)"        placeholder="40"           value={form.sum_max_document_size_mb}     onChange={set('sum_max_document_size_mb')} />
            <NumField label="Max Uploads / Day"        placeholder="15"           value={form.sum_max_file_upload_per_day}  onChange={set('sum_max_file_upload_per_day')} />
            <NumField label="Max Files / Request"      placeholder="10"           value={form.sum_max_upload_files}         onChange={set('sum_max_upload_files')} />
            <NumField label="Max Context Documents"    placeholder="8"            value={form.sum_max_context_documents}    onChange={set('sum_max_context_documents')} />
            <NumField label="Max Conv. History"        placeholder="25"           value={form.sum_max_conversation_history} onChange={set('sum_max_conversation_history')} />
          </DrawerSection>
        </form>

        {/* Footer */}
        <div className="shrink-0 flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/80">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button form="plan-form" type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-sm">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Plan'}
          </button>
        </div>
      </div>
    </>
  );
};

/* ─── Limit chip for expanded row ─── */
const Chip = ({ icon: Icon, label, value, color }) => (
  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${color}`}>
    <Icon className="w-3 h-3 shrink-0" />
    <span className="opacity-70">{label}:</span>
    <span className="font-semibold">{value != null ? Number(value).toLocaleString() : '—'}</span>
  </div>
);

/* ─── API ─── */
const api = {
  base: `${API_BASE_URL}/admin/plans`,
  async req(url, opts = {}) {
    const res = await fetch(url, { ...opts, headers: { ...getAuthHeaders(), ...(opts.headers || {}) } });
    let body = {};
    try { body = await res.json(); } catch { /**/ }
    if (!res.ok) throw new Error(body.message || body.error || `HTTP ${res.status}`);
    return body;
  },
  fetchAll() { return this.req(this.base); },
  create(data) { return this.req(this.base, { method: 'POST', body: JSON.stringify(data) }); },
  update(id, data) { return this.req(`${this.base}/${id}`, { method: 'PUT', body: JSON.stringify(data) }); },
  remove(id) { return this.req(`${this.base}/${id}`, { method: 'DELETE' }); },
};

const sortArr = (arr, key, dir) =>
  [...arr].sort((a, b) => {
    const va = a[key] ?? 0, vb = b[key] ?? 0;
    const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
    return dir === 'asc' ? cmp : -cmp;
  });

function parseForm(form) {
  const out = {
    name:     form.name?.trim(),
    type:     form.type || 'individual',
    currency: form.currency || 'INR',
    interval: form.interval || 'month',
    price:    form.price !== '' && form.price != null ? parseFloat(form.price) : 0,
  };
  const intKeys = Object.keys(EMPTY_FORM).filter((k) => !['name', 'type', 'price', 'currency', 'interval'].includes(k));
  intKeys.forEach((k) => {
    const v = form[k];
    const n = v !== '' && v != null ? parseInt(v, 10) : null;
    out[k] = Number.isFinite(n) ? n : null;
  });
  return out;
}

/* ─── Main component ─── */
const SubscriptionManagement = () => {
  const [plans, setPlans]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [deletingId, setDeletingId]   = useState(null);
  const [search, setSearch]           = useState('');
  const [sortKey, setSortKey]         = useState('name');
  const [sortDir, setSortDir]         = useState('asc');
  const [expandedId, setExpandedId]   = useState(null);

  const [drawer, setDrawer]           = useState({ open: false, mode: 'add', plan: null });
  const [delPlan, setDelPlan]         = useState(null);

  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.fetchAll();
      setPlans(Array.isArray(res.data ?? res) ? (res.data ?? res) : []);
    } catch (e) {
      toast.add(e.message || 'Failed to load plans', 'error');
    } finally { setLoading(false); }
  }, []); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  const openAdd    = () => setDrawer({ open: true, mode: 'add', plan: null });
  const openEdit   = (plan) => setDrawer({ open: true, mode: 'edit', plan });
  const closeDrawer = () => !saving && setDrawer((p) => ({ ...p, open: false }));

  const handleSubmit = async (form) => {
    const payload = parseForm(form);
    if (!payload.name) { toast.add('Plan name is required.', 'warning'); return; }
    if (payload.chat_token_limit == null) { toast.add('Chat token limit is required.', 'warning'); return; }
    if (payload.summarization_token_limit == null) { toast.add('Summarization token limit is required.', 'warning'); return; }
    setSaving(true);
    try {
      if (drawer.mode === 'edit') {
        await api.update(drawer.plan.id, payload);
        toast.add(`"${payload.name}" updated.`, 'success');
      } else {
        await api.create(payload);
        toast.add(`"${payload.name}" created.`, 'success');
      }
      closeDrawer();
      await load();
    } catch (e) {
      toast.add(e.message || 'Operation failed.', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!delPlan) return;
    setDeletingId(delPlan.id);
    try {
      await api.remove(delPlan.id);
      toast.add(`"${delPlan.name}" deleted.`, 'success');
      setDelPlan(null);
      await load();
    } catch (e) {
      toast.add(e.message || 'Delete failed.', 'error');
    } finally { setDeletingId(null); }
  };

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ k }) => (
    <span className="inline-flex flex-col ml-1 opacity-40">
      <ChevronUp   className={`w-2.5 h-2.5 -mb-1 ${sortKey === k && sortDir === 'asc'  ? 'opacity-100 text-blue-600' : ''}`} />
      <ChevronDown className={`w-2.5 h-2.5 ${sortKey === k && sortDir === 'desc' ? 'opacity-100 text-blue-600' : ''}`} />
    </span>
  );

  const filtered = sortArr(
    plans.filter((p) => p.name?.toLowerCase().includes(search.toLowerCase())),
    sortKey, sortDir,
  );

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-slate-100 rounded-xl w-64" />
        <div className="h-4 bg-slate-100 rounded-xl w-96" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-14 bg-slate-100 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes modalIn { from{opacity:0;transform:scale(0.9)} to{opacity:1;transform:scale(1)} }
        @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
        @keyframes slideInRight { from{opacity:0;transform:translateX(100%)} to{opacity:1;transform:translateX(0)} }
        .animate-slide-in-right { animation: slideInRight 0.25s ease-out; }
      `}</style>

      <Toast toasts={toast.toasts} remove={toast.remove} />

      {delPlan && (
        <DeleteModal
          plan={delPlan}
          onClose={() => setDelPlan(null)}
          onConfirm={handleDelete}
          loading={!!deletingId}
        />
      )}

      <PlanDrawer
        isOpen={drawer.open} mode={drawer.mode} plan={drawer.plan}
        onClose={closeDrawer} onSubmit={handleSubmit} saving={saving}
      />

      <div className="p-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-slate-800">Subscription Plans</h1>
            </div>
            <p className="text-sm text-slate-500 ml-11">
              Each plan carries its own Chat Model and Summarization limits.
            </p>
          </div>
          <button onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors">
            <Plus className="w-4 h-4" /> Add Plan
          </button>
        </div>

        {/* ── Table ── */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

          {/* Toolbar */}
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search plans…"
                className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 hover:border-slate-300 transition-all"
              />
            </div>
            <button onClick={load} title="Refresh"
              className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-400 hidden sm:block">{filtered.length} plan{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-4 px-3 py-3" />
                  {[
                    { key: 'id',   label: 'ID',        cls: 'w-14' },
                    { key: 'name', label: 'Plan Name',  cls: '' },
                    { key: 'price', label: 'Price',     cls: 'text-right' },
                    { key: 'chat_token_limit',          label: 'Chat Tokens / Day',  cls: 'text-right' },
                    { key: 'summarization_token_limit', label: 'Sum Tokens / Day',   cls: 'text-right' },
                    { key: null,   label: 'Actions',    cls: 'text-right w-24' },
                  ].map(({ key, label, cls }) => (
                    <th key={label} onClick={() => key && handleSort(key)}
                      className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide select-none ${cls} ${key ? 'cursor-pointer hover:text-slate-700' : ''}`}>
                      {label}{key && <SortIcon k={key} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <CreditCard className="w-10 h-10 opacity-30" />
                        <p className="text-sm font-medium">
                          {search ? 'No plans match your search.' : 'No plans yet.'}
                        </p>
                        {!search && (
                          <button onClick={openAdd}
                            className="mt-1 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                            Add First Plan
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((plan) => {
                  const isExpanded = expandedId === plan.id;
                  return (
                    <React.Fragment key={plan.id}>
                      <tr className={`hover:bg-blue-50/40 transition-colors border-b border-slate-100 ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                        {/* Expand toggle */}
                        <td className="px-3 py-3">
                          <button onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400 font-mono">#{plan.id}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${planTypeColor(plan.type)}`}>
                              <CreditCard className="w-3 h-3" />{plan.name}
                            </span>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border self-start capitalize ${planTypeColor(plan.type)} opacity-80`}>
                              {PLAN_TYPES.find((t) => t.value === plan.type)?.label ?? plan.type ?? 'Individual'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {plan.price != null && Number(plan.price) > 0 ? (
                            <span className="inline-flex items-center gap-1 text-violet-700 font-semibold text-sm">
                              <DollarSign className="w-3 h-3" />
                              {Number(plan.price).toLocaleString()} {plan.currency || 'INR'}
                              <span className="text-xs font-normal text-slate-400">/ {plan.interval || 'mo'}</span>
                            </span>
                          ) : (
                            <span className="text-slate-300 text-sm">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 text-blue-700 font-semibold text-sm">
                            <MessageSquare className="w-3 h-3" />
                            {plan.chat_token_limit != null ? Number(plan.chat_token_limit).toLocaleString() : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-sm">
                            <BookOpen className="w-3 h-3" />
                            {plan.summarization_token_limit != null ? Number(plan.summarization_token_limit).toLocaleString() : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => openEdit(plan)} title="Edit"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => setDelPlan(plan)} title="Delete"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail row */}
                      {isExpanded && (
                        <tr className="bg-gradient-to-r from-blue-50/60 to-emerald-50/60 border-b border-slate-100">
                          <td colSpan={7} className="px-6 py-4">
                            {/* Type + Pricing summary */}
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold capitalize ${planTypeColor(plan.type)}`}>
                                {PLAN_TYPES.find((t) => t.value === plan.type)?.label ?? plan.type ?? 'Individual'}
                              </span>
                              {plan.price != null && Number(plan.price) > 0 && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-violet-100 bg-violet-50 text-xs font-semibold text-violet-800">
                                  <DollarSign className="w-3 h-3" />
                                  {Number(plan.price).toLocaleString()} {plan.currency || 'INR'} / {plan.interval || 'month'}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Chat limits */}
                              <div>
                                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <MessageSquare className="w-3.5 h-3.5" /> Chat Model Limits
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <Chip icon={Activity}  label="Tokens/day"  value={plan.chat_token_limit}             color="bg-blue-50 border-blue-100 text-blue-800" />
                                  <Chip icon={Clock}     label="Msg/hr"       value={plan.chat_messages_per_hour}       color="bg-blue-50 border-blue-100 text-blue-800" />
                                  <Chip icon={Users}     label="Chats/day"    value={plan.chat_chats_per_day}           color="bg-blue-50 border-blue-100 text-blue-800" />
                                  <Chip icon={BarChart2} label="Quota/min"    value={plan.chat_quota_per_minute}        color="bg-blue-50 border-blue-100 text-blue-800" />
                                  <Chip icon={FileText}  label="Max pages"    value={plan.chat_max_document_pages}      color="bg-blue-50 border-blue-100 text-blue-800" />
                                  <Chip icon={FileText}  label="Max doc MB"   value={plan.chat_max_document_size_mb}    color="bg-blue-50 border-blue-100 text-blue-800" />
                                  <Chip icon={Upload}    label="Uploads/day"  value={plan.chat_max_file_upload_per_day} color="bg-blue-50 border-blue-100 text-blue-800" />
                                  <Chip icon={Hash}      label="Files/req"    value={plan.chat_max_upload_files}        color="bg-blue-50 border-blue-100 text-blue-800" />
                                </div>
                              </div>
                              {/* Summarization limits */}
                              <div>
                                <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                  <BookOpen className="w-3.5 h-3.5" /> Summarization Limits
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <Chip icon={Activity}      label="Tokens/day"   value={plan.summarization_token_limit}    color="bg-emerald-50 border-emerald-100 text-emerald-800" />
                                  <Chip icon={Clock}         label="Msg/hr"        value={plan.sum_messages_per_hour}        color="bg-emerald-50 border-emerald-100 text-emerald-800" />
                                  <Chip icon={Users}         label="Chats/day"     value={plan.sum_chats_per_day}            color="bg-emerald-50 border-emerald-100 text-emerald-800" />
                                  <Chip icon={BarChart2}     label="Quota/min"     value={plan.sum_quota_per_minute}         color="bg-emerald-50 border-emerald-100 text-emerald-800" />
                                  <Chip icon={FileText}      label="Max pages"     value={plan.sum_max_document_pages}       color="bg-emerald-50 border-emerald-100 text-emerald-800" />
                                  <Chip icon={FileText}      label="Max doc MB"    value={plan.sum_max_document_size_mb}     color="bg-emerald-50 border-emerald-100 text-emerald-800" />
                                  <Chip icon={Upload}        label="Uploads/day"   value={plan.sum_max_file_upload_per_day}  color="bg-emerald-50 border-emerald-100 text-emerald-800" />
                                  <Chip icon={Hash}          label="Files/req"     value={plan.sum_max_upload_files}         color="bg-emerald-50 border-emerald-100 text-emerald-800" />
                                  <Chip icon={FileText}      label="Context docs"  value={plan.sum_max_context_documents}    color="bg-emerald-50 border-emerald-100 text-emerald-800" />
                                  <Chip icon={MessageSquare} label="Conv. hist"    value={plan.sum_max_conversation_history} color="bg-emerald-50 border-emerald-100 text-emerald-800" />
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default SubscriptionManagement;
