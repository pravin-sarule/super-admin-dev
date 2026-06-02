import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, Plus, Edit2, Trash2, X, Check, AlertTriangle, Search, RefreshCw,
  DollarSign, Calendar, Zap, Package, Repeat, Coins, Clock, Power,
  User, Users, Building2, Mail,
} from 'lucide-react';
import { API_BASE_URL, getAuthHeaders } from '../../config';

/* ─────────────────────────── Toast ─────────────────────────── */
const Toast = ({ toasts, remove }) => (
  <div className="fixed bottom-5 right-5 z-[200] flex flex-col gap-2 pointer-events-none">
    {toasts.map((t) => (
      <div key={t.id}
        className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium min-w-[280px] max-w-xs animate-slide-in-right
          ${t.type === 'success' ? 'bg-white border-emerald-200 text-emerald-800' :
            t.type === 'error'   ? 'bg-white border-red-200   text-red-800'   :
            'bg-white border-amber-200 text-amber-800'}`}>
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

/* ─────────────────────────── Delete confirm ─────────────────────────── */
const DeleteModal = ({ item, kindLabel, onClose, onConfirm, loading }) => {
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(3px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 text-center" style={{ animation: 'modalIn 0.2s ease-out' }}>
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-3">
          <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-base font-semibold text-slate-800 mb-1">Delete {kindLabel}</h3>
        <p className="text-sm text-slate-500 mb-5">
          Delete <span className="font-semibold text-slate-700">"{item?.name}"</span>? This cannot be undone.
        </p>
        <div className="flex gap-3 justify-center">
          <button onClick={onClose} disabled={loading}
            className="px-5 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors">Cancel</button>
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

/* ─────────────────────────── Form fields ─────────────────────────── */
const Label = ({ children, required }) => (
  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
    {children}{required && <span className="text-red-500"> *</span>}
  </label>
);
const inputCls =
  'w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 hover:border-slate-300 transition-all';

const TextField = ({ label, required, value, onChange, placeholder }) => (
  <div><Label required={required}>{label}</Label>
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} /></div>
);
const TextArea = ({ label, value, onChange, placeholder }) => (
  <div><Label>{label}</Label>
    <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${inputCls} resize-none`} /></div>
);
const NumberField = ({ label, required, value, onChange, placeholder, hint, step = '1', min = '0' }) => (
  <div><Label required={required}>{label}</Label>
    <input type="number" min={min} step={step} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? '—'} className={inputCls} />
    {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}</div>
);
const SelectField = ({ label, value, onChange, options }) => (
  <div><Label>{label}</Label>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputCls} appearance-none`}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select></div>
);
const Toggle = ({ label, checked, onChange }) => (
  <div><Label>{label}</Label>
    <button type="button" onClick={() => onChange(!checked)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors w-full justify-center
        ${checked ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
      <Power className="w-3.5 h-3.5" /> {checked ? 'Active' : 'Inactive'}
    </button></div>
);
const Card = ({ icon, color, title, children, cols = 2 }) => {
  const Icon = icon;
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100 bg-slate-50">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}><Icon className="w-4 h-4" /></div>
        <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
      </div>
      <div className={`grid grid-cols-1 ${cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-3' : ''} gap-3 p-4 bg-white`}>{children}</div>
    </div>
  );
};

/* ─────────────────────────── Constants & helpers ─────────────────────────── */
const CURRENCIES = [
  { value: 'INR', label: 'INR ₹' }, { value: 'USD', label: 'USD $' },
  { value: 'EUR', label: 'EUR €' }, { value: 'GBP', label: 'GBP £' },
];
const CURRENCY_SYMBOL = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };

const BILLING_CYCLES = [
  { months: 1, label: 'Monthly' },
  { months: 3, label: 'Quarterly (3 months)' },
  { months: 6, label: 'Half-yearly (6 months)' },
  { months: 12, label: 'Yearly (12 months)' },
];
const billingLabel = (m) => BILLING_CYCLES.find((c) => c.months === Number(m))?.label || `${m} months`;
const billingShort = (m) => { const n = Number(m); return n === 1 ? '/mo' : n === 12 ? '/yr' : `/${n}mo`; };

// Monthly plans are split into these audience sub-tabs (topups stay uncategorised).
const MONTHLY_CATEGORIES = [
  { key: 'solo', label: 'Solo', icon: User },
  { key: 'firm', label: 'Firm', icon: Building2 },
];

const VALIDITY_PRESETS = [
  { days: 1, label: '1 day' }, { days: 7, label: '7 days' }, { days: 15, label: '15 days' },
  { days: 30, label: '30 days' }, { days: 60, label: '60 days' }, { days: 90, label: '90 days' },
  { days: 180, label: '6 months' }, { days: 365, label: '1 year' }, { days: 730, label: '2 years' },
  { days: 1825, label: '5 years' }, { days: 4380, label: '12 years' },
];
const validityLabel = (d) => {
  const n = Number(d);
  return VALIDITY_PRESETS.find((p) => p.days === n)?.label || `${n} day${n === 1 ? '' : 's'}`;
};
const money = (price, currency) => `${CURRENCY_SYMBOL[currency] || ''}${Number(price || 0).toLocaleString()} ${currency || ''}`.trim();
const fmt = (n) => (n != null && n !== '' ? Number(n).toLocaleString() : '—');

const EMPTY_MONTHLY = {
  name: '', description: '', price: '', currency: 'INR',
  monthly_tokens: '', daily_token_limit: '', billing_interval_months: '1',
  category: 'solo', is_custom: false, sort_order: '0', is_active: true,
};
const EMPTY_TOPUP = {
  name: '', description: '', price: '', currency: 'INR',
  tokens: '', validity_days: '30', sort_order: '0', is_active: true,
};

function planToForm(plan, kind) {
  const base = kind === 'monthly' ? EMPTY_MONTHLY : EMPTY_TOPUP;
  const f = {};
  Object.keys(base).forEach((k) => {
    if (k === 'is_active' || k === 'is_custom') f[k] = plan[k] != null ? !!plan[k] : (k === 'is_active');
    else f[k] = plan[k] != null ? String(plan[k]) : '';
  });
  if (!f.currency) f.currency = 'INR';
  return f;
}
const numOrNull = (v) => (v !== '' && v != null ? parseInt(v, 10) : null);
function parseMonthly(form) {
  return {
    name: form.name?.trim(),
    description: form.description?.trim() || null,
    price: form.price !== '' && form.price != null ? parseFloat(form.price) : 0,
    currency: form.currency || 'INR',
    monthly_tokens: numOrNull(form.monthly_tokens),
    daily_token_limit: numOrNull(form.daily_token_limit),
    billing_interval_months: numOrNull(form.billing_interval_months) ?? 1,
    category: form.category === 'firm' ? 'firm' : 'solo',
    is_custom: !!form.is_custom,
    sort_order: numOrNull(form.sort_order) ?? 0,
    is_active: !!form.is_active,
  };
}
function parseTopup(form) {
  return {
    name: form.name?.trim(),
    description: form.description?.trim() || null,
    price: form.price !== '' && form.price != null ? parseFloat(form.price) : 0,
    currency: form.currency || 'INR',
    tokens: numOrNull(form.tokens),
    validity_days: numOrNull(form.validity_days),
    sort_order: numOrNull(form.sort_order) ?? 0,
    is_active: !!form.is_active,
  };
}

/* ─────────────────────────── Drawer ─────────────────────────── */
const PlanDrawer = ({ isOpen, kind, mode, plan, defaultCategory, onClose, onSubmit, saving }) => {
  const empty = kind === 'monthly' ? EMPTY_MONTHLY : EMPTY_TOPUP;
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!isOpen) return;
    setForm(mode === 'edit' && plan
      ? planToForm(plan, kind)
      : { ...empty, ...(kind === 'monthly' && defaultCategory ? { category: defaultCategory } : {}) });
  }, [isOpen, mode, plan, kind, defaultCategory]); // eslint-disable-line
  useEffect(() => { document.body.style.overflow = isOpen ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [isOpen]);

  const set = (k) => (v) => setForm((p) => ({ ...p, [k]: v }));
  const isEdit = mode === 'edit';
  if (!isOpen) return null;

  // Validity dropdown — include the stored value if it isn't a preset.
  const presetDays = VALIDITY_PRESETS.map((p) => String(p.days));
  const validityOpts = (presetDays.includes(String(form.validity_days)) || !form.validity_days)
    ? VALIDITY_PRESETS
    : [...VALIDITY_PRESETS, { days: Number(form.validity_days), label: validityLabel(form.validity_days) }];

  const Icon = kind === 'monthly' ? Repeat : Package;
  const title = `${isEdit ? 'Edit' : 'Add'} ${kind === 'monthly' ? 'Monthly Plan' : 'Topup Plan'}`;

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm" style={{ animation: 'fadeIn 0.18s ease-out' }} onClick={onClose} />
      <div className="fixed right-0 top-0 h-full z-[110] w-full max-w-xl bg-white shadow-2xl flex flex-col" style={{ animation: 'slideInRight 0.22s cubic-bezier(0.22,1,0.36,1)' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-50"><Icon className="w-4 h-4 text-blue-600" /></div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">{title}</h3>
              <p className="text-xs text-slate-400">
                {kind === 'monthly' ? 'Recurring plan with a monthly token grant + daily cap' : 'One-time token pack with a validity period'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <form id="plan-form" onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <TextField label="Plan Name" required value={form.name} onChange={set('name')}
            placeholder={kind === 'monthly' ? 'e.g. Basic, Pro, Enterprise' : 'e.g. Booster 5K, Power Pack'} />
          <TextArea label="Description" value={form.description} onChange={set('description')}
            placeholder="Short description shown to users" />

          {kind === 'monthly' ? (
            <>
              <Card icon={Users} color="bg-indigo-50 text-indigo-600" title="Audience">
                <SelectField label="Category" value={form.category} onChange={set('category')}
                  options={MONTHLY_CATEGORIES.map((c) => ({ value: c.key, label: c.label }))} />
                <div>
                  <Label>Plan Kind</Label>
                  <button type="button" onClick={() => set('is_custom')(!form.is_custom)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors w-full justify-center
                      ${form.is_custom ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                    <Mail className="w-3.5 h-3.5" /> {form.is_custom ? 'Contact us (custom)' : 'Standard plan'}
                  </button>
                </div>
              </Card>
              <Card icon={DollarSign} color="bg-violet-50 text-violet-600" title="Pricing & Billing" cols={3}>
                <NumberField label="Price" required={!form.is_custom} value={form.price} onChange={set('price')} placeholder={form.is_custom ? 'Contact us' : '0.00'} step="0.01" />
                <SelectField label="Currency" value={form.currency} onChange={set('currency')} options={CURRENCIES} />
                <SelectField label="Billing Cycle" value={form.billing_interval_months} onChange={set('billing_interval_months')}
                  options={BILLING_CYCLES.map((c) => ({ value: String(c.months), label: c.label }))} />
              </Card>
              <Card icon={Coins} color="bg-blue-50 text-blue-600" title="Tokens">
                <NumberField label="Monthly Tokens" required={!form.is_custom} value={form.monthly_tokens} onChange={set('monthly_tokens')}
                  placeholder={form.is_custom ? 'Custom / negotiated' : 'e.g. 30000'} hint="Granted per month" />
                <NumberField label="Daily Token Limit" value={form.daily_token_limit} onChange={set('daily_token_limit')}
                  placeholder="e.g. 2000" hint="Leave blank = no daily cap" />
              </Card>
              {form.is_custom && (
                <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-amber-50/70 border border-amber-100 text-xs text-amber-700">
                  <Mail className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>This is a <b>Contact us</b> plan — price &amp; tokens are optional; it shows a contact CTA instead of a buy button.</span>
                </div>
              )}
            </>
          ) : (
            <>
              <Card icon={DollarSign} color="bg-violet-50 text-violet-600" title="Pricing">
                <NumberField label="Price" required value={form.price} onChange={set('price')} placeholder="0.00" step="0.01" />
                <SelectField label="Currency" value={form.currency} onChange={set('currency')} options={CURRENCIES} />
              </Card>
              <Card icon={Zap} color="bg-amber-50 text-amber-600" title="Tokens & Validity">
                <NumberField label="Tokens" required value={form.tokens} onChange={set('tokens')} placeholder="e.g. 5000" hint="Granted on purchase" />
                <SelectField label="Validity" value={form.validity_days} onChange={set('validity_days')}
                  options={validityOpts.map((p) => ({ value: String(p.days), label: p.label }))} />
              </Card>
              <div className="flex items-start gap-2 px-3.5 py-2.5 rounded-lg bg-amber-50/70 border border-amber-100 text-xs text-amber-700">
                <Zap className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Topup credits are <b>not</b> subject to any daily limit — usable anytime, any amount, until they expire.</span>
              </div>
            </>
          )}

          <Card icon={Power} color="bg-emerald-50 text-emerald-600" title="Visibility">
            <Toggle label="Status" checked={!!form.is_active} onChange={set('is_active')} />
            <NumberField label="Display Order" value={form.sort_order} onChange={set('sort_order')} placeholder="0" hint="Lower shows first" />
          </Card>
        </form>

        {/* Footer */}
        <div className="shrink-0 flex gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50/80">
          <button type="button" onClick={onClose} disabled={saving}
            className="flex-1 py-2.5 rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">Cancel</button>
          <button form="plan-form" type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-sm">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </>
  );
};

/* ─────────────────────────── API ─────────────────────────── */
function makeApi(path) {
  const base = `${API_BASE_URL}${path}`;
  const req = async (url, opts = {}) => {
    const res = await fetch(url, { ...opts, headers: { ...getAuthHeaders(), ...(opts.headers || {}) } });
    let body = {};
    try { body = await res.json(); } catch { /**/ }
    if (!res.ok) throw new Error(body.message || body.error || `HTTP ${res.status}`);
    return body;
  };
  return {
    fetchAll: () => req(base),
    create: (data) => req(base, { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => req(`${base}/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id) => req(`${base}/${id}`, { method: 'DELETE' }),
  };
}
const monthlyApi = makeApi('/admin/monthly-plans');
const topupApi = makeApi('/admin/topup-plans');

/* ─────────────────────────── Shared row bits ─────────────────────────── */
const StatusBadge = ({ active, onClick }) => (
  <button onClick={onClick} title="Toggle active"
    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border transition-colors
      ${active ? 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100'
               : 'bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100'}`}>
    <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
    {active ? 'Active' : 'Inactive'}
  </button>
);
const RowActions = ({ onEdit, onDelete }) => (
  <div className="flex items-center justify-end gap-1.5">
    <button onClick={onEdit} title="Edit" className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
    <button onClick={onDelete} title="Delete" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
  </div>
);
const NameCell = ({ icon, name, tint }) => {
  const Icon = icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${tint}`}>
      <Icon className="w-3 h-3" />{name}
    </span>
  );
};
const Th = ({ children, right }) => (
  <th className={`px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide ${right ? 'text-right' : ''}`}>{children}</th>
);

/* ─────────────────────────── Main ─────────────────────────── */
const TABS = [
  { key: 'monthly', label: 'Monthly Plans', icon: Repeat },
  { key: 'topup', label: 'Topup Plans', icon: Package },
];

const SubscriptionManagement = () => {
  const [tab, setTab] = useState('monthly');
  const [monthlyCat, setMonthlyCat] = useState('solo'); // Solo | Firm sub-tab (monthly only)
  const [monthly, setMonthly] = useState([]);
  const [topup, setTopup] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [search, setSearch] = useState('');
  const [drawer, setDrawer] = useState({ open: false, mode: 'add', plan: null });
  const [delTarget, setDelTarget] = useState(null);
  const toast = useToast();

  const api = tab === 'monthly' ? monthlyApi : topupApi;
  const list = tab === 'monthly' ? monthly : topup;
  const kindLabel = tab === 'monthly' ? 'Monthly Plan' : 'Topup Plan';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, t] = await Promise.all([monthlyApi.fetchAll(), topupApi.fetchAll()]);
      setMonthly(Array.isArray(m.data) ? m.data : []);
      setTopup(Array.isArray(t.data) ? t.data : []);
    } catch (e) {
      toast.add(e.message || 'Failed to load plans', 'error');
    } finally { setLoading(false); }
  }, []); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  const openAdd = () => setDrawer({ open: true, mode: 'add', plan: null });
  const openEdit = (plan) => setDrawer({ open: true, mode: 'edit', plan });
  const closeDrawer = () => !saving && setDrawer((p) => ({ ...p, open: false }));

  const handleSubmit = async (form) => {
    const payload = tab === 'monthly' ? parseMonthly(form) : parseTopup(form);
    if (!payload.name) return toast.add('Plan name is required.', 'warning');
    if (tab === 'monthly' && !payload.is_custom && payload.monthly_tokens == null) return toast.add('Monthly tokens is required.', 'warning');
    if (tab === 'topup' && payload.tokens == null) return toast.add('Tokens is required.', 'warning');
    if (tab === 'topup' && !payload.validity_days) return toast.add('Validity is required.', 'warning');
    setSaving(true);
    try {
      if (drawer.mode === 'edit') { await api.update(drawer.plan.id, payload); toast.add(`"${payload.name}" updated.`, 'success'); }
      else { await api.create(payload); toast.add(`"${payload.name}" created.`, 'success'); }
      closeDrawer();
      await load();
    } catch (e) { toast.add(e.message || 'Operation failed.', 'error'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!delTarget) return;
    setDeletingId(delTarget.id);
    try {
      await api.remove(delTarget.id);
      toast.add(`"${delTarget.name}" deleted.`, 'success');
      setDelTarget(null);
      await load();
    } catch (e) { toast.add(e.message || 'Delete failed.', 'error'); }
    finally { setDeletingId(null); }
  };

  const toggleActive = async (plan) => {
    try {
      await api.update(plan.id, { is_active: !plan.is_active });
      await load();
    } catch (e) { toast.add(e.message || 'Could not update status.', 'error'); }
  };

  const filtered = list
    .filter((p) => (tab === 'monthly' ? p.category === monthlyCat : true))
    .filter((p) => p.name?.toLowerCase().includes(search.toLowerCase()));

  if (loading) {
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-slate-100 rounded-xl w-64" />
        <div className="h-4 bg-slate-100 rounded-xl w-96" />
        {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl" />)}
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
      {delTarget && <DeleteModal item={delTarget} kindLabel={kindLabel} onClose={() => setDelTarget(null)} onConfirm={handleDelete} loading={!!deletingId} />}
      <PlanDrawer isOpen={drawer.open} kind={tab} mode={drawer.mode} plan={drawer.plan} defaultCategory={monthlyCat} onClose={closeDrawer} onSubmit={handleSubmit} saving={saving} />

      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm"><CreditCard className="w-5 h-5 text-white" /></div>
              <h1 className="text-xl font-bold text-slate-800">Subscription Plans</h1>
            </div>
            <p className="text-sm text-slate-500 ml-11">Monthly plans grant tokens per cycle with a daily cap. Topup packs add tokens that last until they expire.</p>
          </div>
          <button onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors">
            <Plus className="w-4 h-4" /> Add {tab === 'monthly' ? 'Monthly Plan' : 'Topup Plan'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-slate-200">
          {TABS.map((t) => {
            const active = tab === t.key;
            const count = t.key === 'monthly' ? monthly.length : topup.length;
            return (
              <button key={t.key} onClick={() => { setTab(t.key); setSearch(''); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors
                  ${active ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <t.icon className="w-4 h-4" /> {t.label}
                <span className={`px-1.5 py-0.5 rounded-md text-[11px] ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Solo / Firm sub-tabs (monthly only) */}
        {tab === 'monthly' && (
          <div className="flex items-center gap-2">
            {MONTHLY_CATEGORIES.map((c) => {
              const active = monthlyCat === c.key;
              const count = monthly.filter((p) => p.category === c.key).length;
              return (
                <button key={c.key} onClick={() => { setMonthlyCat(c.key); setSearch(''); }}
                  className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-sm font-semibold border transition-colors
                    ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                  <c.icon className="w-3.5 h-3.5" /> {c.label}
                  <span className={`px-1.5 py-0.5 rounded-md text-[11px] ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Table card */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-slate-100">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={`Search ${tab} plans…`}
                className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 hover:border-slate-300 transition-all" />
            </div>
            <button onClick={load} title="Refresh" className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-blue-600 transition-colors"><RefreshCw className="w-4 h-4" /></button>
            <span className="text-xs text-slate-400 hidden sm:block">{filtered.length} plan{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <Th>ID</Th>
                  <Th>{tab === 'monthly' ? 'Plan Name' : 'Pack Name'}</Th>
                  <Th right>Price</Th>
                  {tab === 'monthly' ? (
                    <>
                      <Th>Cycle</Th>
                      <Th right>Monthly Tokens</Th>
                      <Th right>Daily Limit</Th>
                    </>
                  ) : (
                    <>
                      <Th right>Tokens</Th>
                      <Th>Validity</Th>
                    </>
                  )}
                  <Th>Status</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        {tab === 'monthly' ? <Repeat className="w-10 h-10 opacity-30" /> : <Package className="w-10 h-10 opacity-30" />}
                        <p className="text-sm font-medium">{search ? 'No plans match your search.' : `No ${tab} plans yet.`}</p>
                        {!search && (
                          <button onClick={openAdd} className="mt-1 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                            Add First {tab === 'monthly' ? 'Monthly Plan' : 'Topup Plan'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((plan) => (
                  <tr key={plan.id} className="hover:bg-blue-50/40 transition-colors border-b border-slate-100">
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">#{plan.id}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <NameCell icon={tab === 'monthly' ? Repeat : Package} name={plan.name}
                            tint={tab === 'monthly' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-amber-50 text-amber-700 border-amber-100'} />
                          {plan.is_custom && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100"><Mail className="w-2.5 h-2.5" />Contact us</span>}
                        </div>
                        {plan.description && <span className="text-xs text-slate-400 max-w-xs truncate">{plan.description}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {plan.is_custom ? (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-sm"><Mail className="w-3 h-3" />Contact us</span>
                      ) : Number(plan.price) > 0 ? (
                        <span className="inline-flex items-center gap-1 text-violet-700 font-semibold text-sm">
                          {money(plan.price, plan.currency)}
                          {tab === 'monthly' && <span className="text-xs font-normal text-slate-400">{billingShort(plan.billing_interval_months)}</span>}
                        </span>
                      ) : <span className="text-slate-300 text-sm">Free</span>}
                    </td>
                    {tab === 'monthly' ? (
                      <>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-violet-50 text-violet-700 border border-violet-100">
                            <Calendar className="w-3 h-3" />{billingLabel(plan.billing_interval_months)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {plan.is_custom
                            ? <span className="text-slate-400 text-sm italic">Custom</span>
                            : <span className="inline-flex items-center gap-1 text-blue-700 font-semibold text-sm"><Coins className="w-3 h-3" />{fmt(plan.monthly_tokens)}</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 font-medium">{plan.is_custom ? <span className="text-slate-300">—</span> : plan.daily_token_limit != null ? fmt(plan.daily_token_limit) : <span className="text-slate-300">No cap</span>}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-flex items-center gap-1 text-amber-700 font-semibold text-sm"><Zap className="w-3 h-3" />{fmt(plan.tokens)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-50 text-slate-600 border border-slate-200">
                            <Clock className="w-3 h-3" />{validityLabel(plan.validity_days)}
                          </span>
                        </td>
                      </>
                    )}
                    <td className="px-4 py-3"><StatusBadge active={!!plan.is_active} onClick={() => toggleActive(plan)} /></td>
                    <td className="px-4 py-3 text-right"><RowActions onEdit={() => openEdit(plan)} onDelete={() => setDelTarget(plan)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
};

export default SubscriptionManagement;
