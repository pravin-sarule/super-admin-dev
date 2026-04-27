import React, { useState, useEffect } from 'react';
import {
  Bot, Mic, Save, RefreshCw, AlertCircle, CheckCircle,
  ChevronDown, Volume2, Sliders, MessageSquare, Cpu,
} from 'lucide-react';
import chatbotConfigService from '../../services/chatbotConfigService';

// ── Constants ─────────────────────────────────────────────────────────────────

const GEMINI_TEXT_MODELS = [
  'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro',
  'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro',
];

const GEMINI_LIVE_MODELS = [
  'gemini-3.1-flash-live-preview',
  'gemini-2.5-flash-native-audio-preview-12-2025',
];

// All 30 official Gemini Live API voices
const VOICE_OPTIONS = [
  { value: 'Puck', style: 'Upbeat' }, { value: 'Fenrir', style: 'Upbeat' }, { value: 'Laomedeia', style: 'Upbeat' },
  { value: 'Zephyr', style: 'Bright' }, { value: 'Kore', style: 'Bright' }, { value: 'Orus', style: 'Bright' }, { value: 'Autonoe', style: 'Bright' },
  { value: 'Charon', style: 'Clear' }, { value: 'Iapetus', style: 'Clear' }, { value: 'Erinome', style: 'Clear' }, { value: 'Alnilam', style: 'Clear' },
  { value: 'Aoede', style: 'Calm' }, { value: 'Umbriel', style: 'Calm' }, { value: 'Callirrhoe', style: 'Calm' }, { value: 'Despina', style: 'Calm' }, { value: 'Algieba', style: 'Calm' }, { value: 'Achernar', style: 'Calm' },
  { value: 'Schedar', style: 'Distinct' }, { value: 'Achird', style: 'Distinct' }, { value: 'Sadachbia', style: 'Distinct' }, { value: 'Enceladus', style: 'Distinct' }, { value: 'Algenib', style: 'Distinct' },
  { value: 'Gacrux', style: 'Distinct' }, { value: 'Zubenelgenubi', style: 'Distinct' }, { value: 'Sadaltager', style: 'Distinct' }, { value: 'Leda', style: 'Distinct' }, { value: 'Rasalgethi', style: 'Distinct' },
  { value: 'Pulcherrima', style: 'Distinct' }, { value: 'Vindemiatrix', style: 'Distinct' }, { value: 'Sulafat', style: 'Distinct' },
];

const VOICE_STYLE_COLORS = {
  Upbeat: 'bg-green-100 text-green-700', Bright: 'bg-yellow-100 text-yellow-700',
  Clear: 'bg-blue-100 text-blue-700', Calm: 'bg-purple-100 text-purple-700', Distinct: 'bg-slate-100 text-slate-600',
};

// speaking_rate / pitch / volume_gain_db / language_code are NOT supported by the Gemini Live API
const DEFAULTS = {
  model_text: 'gemini-1.5-flash',
  max_tokens: 150,
  temperature: 0.1,
  top_p: 0.95,
  top_k_results: 5,
  model_audio: 'gemini-3.1-flash-live-preview',
  voice_name: 'Puck',
  system_prompt: "You are the Nexintel AI Support Agent. Provide fast, accurate solutions based ONLY on the provided document context. If the answer is not found, state: \"I'm sorry, I don't have information on that in our records.\" Keep responses under 3 sentences.",
  audio_system_prompt: "You are the Nexintel AI Support Agent. Provide fast, accurate answers based ONLY on documents retrieved via search_documents. Keep spoken responses under 20 seconds.",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const Field = ({ label, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    {children}
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
);

const SliderField = ({ label, hint, value, min, max, step, onChange, format }) => (
  <Field label={`${label}: ${format ? format(value) : value}`} hint={hint}>
    <input
      type="range" min={min} max={max} step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
    />
    <div className="flex justify-between text-xs text-gray-400 mt-0.5">
      <span>{min}</span><span>{max}</span>
    </div>
  </Field>
);

const NumberField = ({ label, hint, value, min, max, step, onChange }) => (
  <Field label={label} hint={hint}>
    <input
      type="number" min={min} max={max} step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
    />
  </Field>
);

const SelectField = ({ label, hint, value, options, onChange }) => (
  <Field label={label} hint={hint}>
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white"
      >
        {options.map((o) => (
          <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
            {typeof o === 'string' ? o : o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
  </Field>
);

const TextareaField = ({ label, hint, value, rows = 4, onChange }) => (
  <Field label={label} hint={hint}>
    <textarea
      rows={rows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y font-mono"
    />
  </Field>
);

const SectionCard = ({ icon: Icon, title, iconColor, children }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
    <div className="flex items-center gap-2 mb-5">
      <Icon className={`w-5 h-5 ${iconColor}`} />
      <h2 className="text-base font-semibold text-gray-800">{title}</h2>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">{children}</div>
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────

const ChatbotConfig = () => {
  const [form, setForm] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg }

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const showToast = (type, msg) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    (async () => {
      try {
        const { config } = await chatbotConfigService.getConfig();
        setForm((prev) => ({ ...prev, ...config }));
      } catch (err) {
        showToast('error', `Failed to load config: ${err.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { config } = await chatbotConfigService.updateConfig(form);
      setForm((prev) => ({ ...prev, ...config }));
      showToast('success', 'Configuration saved successfully.');
    } catch (err) {
      showToast('error', err.message || 'Failed to save config.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(DEFAULTS);
    showToast('success', 'Fields reset to defaults (not yet saved).');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-indigo-600" />
          <p className="text-gray-500 text-sm">Loading chatbot configuration…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 bg-indigo-600 rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Chatbot Configuration</h1>
                <p className="text-sm text-gray-500">Text model, live audio voice & system prompts</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                <RefreshCw className="w-4 h-4" /> Reset Defaults
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>

        {/* Toast */}
        {toast && (
          <div className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {toast.type === 'success'
              ? <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
              : <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />}
            {toast.msg}
          </div>
        )}

        {/* ── Text Model ──────────────────────────────────────────────────────── */}
        <SectionCard icon={Cpu} title="Text Model" iconColor="text-blue-500">
          <SelectField
            label="Model"
            hint="Used for text-based Q&A responses"
            value={form.model_text}
            options={GEMINI_TEXT_MODELS}
            onChange={set('model_text')}
          />
          <NumberField
            label="Max Output Tokens"
            hint="Max tokens in a single response (50–2048)"
            value={form.max_tokens} min={50} max={2048} step={50}
            onChange={set('max_tokens')}
          />
          <SliderField
            label="Temperature"
            hint="Lower = more deterministic"
            value={form.temperature} min={0} max={1} step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={set('temperature')}
          />
          <SliderField
            label="Top-P (nucleus sampling)"
            hint="Controls output diversity"
            value={form.top_p} min={0} max={1} step={0.01}
            format={(v) => v.toFixed(2)}
            onChange={set('top_p')}
          />
          <NumberField
            label="Top-K Results (RAG)"
            hint="Number of document chunks retrieved for context"
            value={form.top_k_results} min={1} max={20} step={1}
            onChange={set('top_k_results')}
          />
        </SectionCard>

        {/* ── Live / Audio Model ──────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Mic className="w-5 h-5 text-purple-500" />
            <h2 className="text-base font-semibold text-gray-800">Live Audio Model</h2>
          </div>
          <div className="max-w-sm">
            <SelectField label="Live Model" hint="Used for real-time voice conversations"
              value={form.model_audio} options={GEMINI_LIVE_MODELS} onChange={set('model_audio')} />
          </div>
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 max-w-lg">
            The Gemini Live API does not expose speaking rate, pitch, volume, or language code as configurable parameters — the model handles these automatically.
          </p>
        </div>

        {/* ── Voice Selection — all 30 official voices ────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-purple-500" />
              <h2 className="text-base font-semibold text-gray-800">Voice Selection</h2>
              <span className="text-xs font-medium px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{form.voice_name}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['All','Upbeat','Bright','Clear','Calm','Distinct'].map((s) => (
                <button key={s} onClick={() => set('_styleFilter')(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
                    (form._styleFilter || 'All') === s
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                  }`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-6 gap-2 max-h-64 overflow-y-auto pr-1">
            {VOICE_OPTIONS
              .filter((v) => !form._styleFilter || form._styleFilter === 'All' || v.style === form._styleFilter)
              .map(({ value, style }) => (
                <button key={value} onClick={() => set('voice_name')(value)}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all ${
                    form.voice_name === value
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    form.voice_name === value ? 'bg-indigo-500' : 'bg-gray-100'
                  }`}>
                    <Mic className={`w-3.5 h-3.5 ${form.voice_name === value ? 'text-white' : 'text-gray-500'}`} />
                  </div>
                  <span className={`text-xs font-semibold text-center leading-tight ${
                    form.voice_name === value ? 'text-indigo-700' : 'text-gray-700'
                  }`}>{value}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${VOICE_STYLE_COLORS[style]}`}>{style}</span>
                </button>
              ))}
          </div>
        </div>

        {/* ── System Prompts ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <MessageSquare className="w-5 h-5 text-green-500" />
            <h2 className="text-base font-semibold text-gray-800">System Prompts</h2>
          </div>
          <div className="space-y-5">
            <TextareaField
              label="Text Chat System Prompt"
              hint="Injected before every text-model conversation"
              rows={5}
              value={form.system_prompt}
              onChange={set('system_prompt')}
            />
            <TextareaField
              label="Audio / Live Model System Prompt"
              hint="Injected before every Live audio session — keep concise for voice"
              rows={4}
              value={form.audio_system_prompt}
              onChange={set('audio_system_prompt')}
            />
          </div>
        </div>

        {/* ── Config Summary ────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sliders className="w-5 h-5 text-orange-500" />
            <h2 className="text-base font-semibold text-gray-800">Active Configuration Summary</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { label: 'Text Model',    value: form.model_text },
              { label: 'Live Model',    value: form.model_audio },
              { label: 'Voice',         value: form.voice_name },
              { label: 'Temperature',   value: Number(form.temperature).toFixed(2) },
              { label: 'Top-P',         value: Number(form.top_p).toFixed(2) },
              { label: 'Max Tokens',    value: form.max_tokens },
              { label: 'Top-K Results', value: form.top_k_results },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
                <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Save Footer */}
        <div className="flex justify-end pb-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60 shadow"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Configuration'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ChatbotConfig;
