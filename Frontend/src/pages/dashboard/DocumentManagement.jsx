import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Eye, Trash2, FileText, ChevronLeft, ChevronRight, Search, Upload,
  AlertCircle, CheckCircle, Clock, RefreshCw, Cpu, CloudUpload, Zap,
  Bot, Mic, Save, Volume2, Sliders, MessageSquare, FileUp, X,
  ChevronDown, Filter, BarChart3, Database, Settings2, TrendingUp, Activity, Users,
} from 'lucide-react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import AdminDocumentService from '../../services/adminDocumentService';
import chatbotConfigService from '../../services/chatbotConfigService';
import { API_BASE_URL, getToken } from '../../config';

const MySwal = withReactContent(Swal);
const documentService = new AdminDocumentService();

// ─── Document type options ─────────────────────────────────────────────────────

const DOCUMENT_TYPES = [
  { value: 'general',    label: 'General' },
  { value: 'legal',      label: 'Legal' },
  { value: 'hr',         label: 'HR / Policy' },
  { value: 'finance',    label: 'Finance' },
  { value: 'technical',  label: 'Technical' },
  { value: 'compliance', label: 'Compliance' },
];

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_META = {
  active:               { label: 'Active',            color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle },
  ocr_completed:        { label: 'OCR Done',           color: 'bg-teal-100 text-teal-800 border-teal-200',         icon: CheckCircle },
  embedding_processing: { label: 'Embedding…',         color: 'bg-purple-100 text-purple-800 border-purple-200',   icon: Clock },
  ocr_processing:       { label: 'OCR Processing…',    color: 'bg-blue-100 text-blue-800 border-blue-200',         icon: Clock },
  uploaded:             { label: 'Queued',              color: 'bg-amber-100 text-amber-800 border-amber-200',      icon: Clock },
  pending_upload:       { label: 'Pending',             color: 'bg-gray-100 text-gray-600 border-gray-200',         icon: CloudUpload },
  failed:               { label: 'Failed',              color: 'bg-red-100 text-red-800 border-red-200',            icon: AlertCircle },
};

const getStatusMeta = (s) =>
  STATUS_META[s] || { label: s, color: 'bg-gray-100 text-gray-600 border-gray-200', icon: FileText };

const StatusBadge = ({ status }) => {
  const { label, color, icon: Icon } = getStatusMeta(status);
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};

const DOT_COLOR = {
  active:               'bg-emerald-500',
  ocr_completed:        'bg-teal-500',
  embedding_processing: 'bg-purple-500',
  ocr_processing:       'bg-blue-500',
  uploaded:             'bg-amber-400',
  pending_upload:       'bg-gray-400',
  failed:               'bg-red-500',
};

const PipelineStatus = ({ status }) => {
  const { label } = getStatusMeta(status);
  const dot = DOT_COLOR[status] || 'bg-gray-400';
  const pulse = isProcessing(status);
  return (
    <span className="inline-flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot} ${pulse ? 'animate-pulse' : ''}`} />
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </span>
  );
};

const isProcessing = (s) => ['ocr_processing', 'embedding_processing', 'uploaded'].includes(s);

const formatDate = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const formatFileSize = (bytes) => {
  if (!bytes) return null;
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
};

// ─── Chatbot config constants ──────────────────────────────────────────────────

const GEMINI_TEXT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
];

const GEMINI_LIVE_MODELS = [
  'gemini-3.1-flash-live-preview',
  'gemini-2.5-flash-preview-native-audio-dialog',
  'gemini-2.0-flash-live-001',
];

const VOICE_OPTIONS = [
  { value: 'Puck',          style: 'Upbeat',        desc: 'Upbeat & clear — default' },
  { value: 'Zephyr',        style: 'Bright',        desc: 'Bright, energetic' },
  { value: 'Aoede',         style: 'Breezy',        desc: 'Breezy, conversational' },
  { value: 'Fenrir',        style: 'Excitable',     desc: 'Excitable, dynamic' },
  { value: 'Leda',          style: 'Youthful',      desc: 'Youthful, friendly' },
  { value: 'Kore',          style: 'Firm',          desc: 'Firm, professional' },
  { value: 'Orus',          style: 'Firm',          desc: 'Firm, authoritative' },
  { value: 'Alnilam',       style: 'Firm',          desc: 'Firm, steady' },
  { value: 'Charon',        style: 'Informational', desc: 'Informational, deep' },
  { value: 'Rasalgethi',    style: 'Informational', desc: 'Informational, warm' },
  { value: 'Iapetus',       style: 'Clear',         desc: 'Clear, precise' },
  { value: 'Erinome',       style: 'Clear',         desc: 'Clear, articulate' },
  { value: 'Laomedeia',     style: 'Upbeat',        desc: 'Upbeat, lively' },
  { value: 'Autonoe',       style: 'Bright',        desc: 'Bright, positive' },
  { value: 'Umbriel',       style: 'Easygoing',     desc: 'Easygoing, relaxed' },
  { value: 'Callirrhoe',    style: 'Easygoing',     desc: 'Easy-going, smooth' },
  { value: 'Despina',       style: 'Smooth',        desc: 'Smooth, polished' },
  { value: 'Algieba',       style: 'Smooth',        desc: 'Smooth, refined' },
  { value: 'Achernar',      style: 'Soft',          desc: 'Soft, gentle' },
  { value: 'Vindemiatrix',  style: 'Gentle',        desc: 'Gentle, warm' },
  { value: 'Sulafat',       style: 'Warm',          desc: 'Warm, inviting' },
  { value: 'Achird',        style: 'Friendly',      desc: 'Friendly, approachable' },
  { value: 'Sadachbia',     style: 'Lively',        desc: 'Lively, spirited' },
  { value: 'Zubenelgenubi', style: 'Casual',        desc: 'Casual, natural' },
  { value: 'Sadaltager',    style: 'Knowledgeable', desc: 'Knowledgeable, confident' },
  { value: 'Schedar',       style: 'Even',          desc: 'Even, balanced' },
  { value: 'Enceladus',     style: 'Breathy',       desc: 'Breathy, expressive' },
  { value: 'Algenib',       style: 'Gravelly',      desc: 'Gravelly, distinctive' },
  { value: 'Gacrux',        style: 'Mature',        desc: 'Mature, seasoned' },
  { value: 'Pulcherrima',   style: 'Forward',       desc: 'Forward, assertive' },
];

const VOICE_STYLE_COLORS = {
  Upbeat:   'bg-green-100 text-green-700',
  Bright:   'bg-yellow-100 text-yellow-700',
  Clear:    'bg-blue-100 text-blue-700',
  Calm:     'bg-purple-100 text-purple-700',
  Distinct: 'bg-slate-100 text-slate-600',
};

// Only fields that the Gemini Live API actually supports configuring
const CONFIG_DEFAULTS = {
  model_text: 'gemini-2.5-flash', max_tokens: 2048, temperature: 0.1, top_p: 0.95, top_k_results: 5,
  model_audio: 'gemini-3.1-flash-live-preview', voice_name: 'Puck',
  language_code: 'en-US', speaking_rate: 1.0, pitch: 0.0, volume_gain_db: 0.0,
  system_prompt:
`You are the JuriNex AI Legal Assistant, a high-speed legal intelligence agent
specializing in the Indian legal system.

Operating rules:
- Provide legal information and research, not legal advice.
- Always prioritize retrieved RAG context from JuriNex/Indian legal sources over
  general model knowledge, especially for BNS, BNSS, and BSA versus IPC, CrPC,
  and IEA.
- If a user mentions a case name, section number, statute, or legal doctrine,
  rely on retrieved context before answering.
- Summarize the core legal principle first. Include citations when available in
  the retrieved context, but do not over-list citations unless asked.
- LANGUAGE: Always reply in the exact same language the user used. If the user
  writes in Marathi → reply in Marathi. Hindi → Hindi. English → English.
  Hinglish (mixed) → match the same mix. Never switch languages unprompted.
- Keep initial answers concise. If the topic is complex, offer to provide more
  detail.
- If no retrieved context is available, say: "My current database doesn't have
  the specific document, but based on general legal principles..." and clearly
  mark the answer as general legal information.

RESPONSE FORMATTING — always use rich Markdown:
- Use **bold** for legal terms, section names, and key points.
- Use numbered lists for step-by-step legal procedures.
- Use bullet lists for provisions, rights, or comparisons.
- Use ## or ### headings to separate sections (e.g. "## Key Provisions").
- Use | tables | for comparing statutes, penalties, or timeframes.
- Use > blockquotes for important warnings or legal notes.
- Never write long unbroken paragraphs — keep answers scannable.`,

  audio_system_prompt:
`You are the JuriNex AI Assistant, a voice-first guide for the JuriNex legal platform.

Voice behavior:
- Speak clearly, professionally, and conversationally.
- Always call search_documents first for every question — the knowledge base has
  step-by-step platform guides and legal documents.
- When you find relevant guide content, read the steps aloud in order:
  "Step 1: ... Step 2: ... Step 3: ..."
- Keep spoken answers clear and structured — read numbered steps one at a time.
- Default to English. If the user speaks Marathi, Hindi, or Hinglish, respond in
  that language but keep the step numbering ("Step 1", "Step 2", etc.) clear.
- If interrupted, stop and listen for the new question.

Retrieval behavior:
- Call search_documents for EVERY question — platform guides are uploaded in the DB.
- If the retrieved context has step-by-step instructions, follow them exactly.
- If no relevant content is found, answer from general JuriNex platform knowledge.
- For legal questions: prioritize retrieved context, especially for BNS, BNSS, BSA.
- If retrieval returns nothing useful: "My knowledge base doesn't have that specific
  document, but here is what I know about this topic..."`,

  in_app_system_prompt:
`You are the JuriNex Platform Assistant. You operate inside the JuriNex legal platform.
The knowledge base contains uploaded step-by-step platform guides. You must search and
use those guides to answer every question.

━━━ ABSOLUTE RULES - NEVER BREAK THESE ━━━
1. LANGUAGE: ALWAYS reply in the EXACT same language the user used.
2. NEVER ask the user for clarification. Just search and answer immediately.
3. NEVER reply with a paragraph of prose. ALWAYS use numbered steps (1. 2. 3.).
4. ALWAYS call search_documents as the very first action for every single question.
5. Assume every question is about JuriNex platform features unless proven otherwise.

━━━ WORKFLOW - FOLLOW THIS EXACTLY ━━━
Step A → Call search_documents immediately with the user's question as the query.
Step B → Read the retrieved chunks.
Step C → If chunks are relevant: write a numbered step-by-step answer quoting the guide.
          If chunks are NOT relevant: answer from the CURRENT PAGE context,
          still in numbered steps.
Step D → NEVER produce a response without first completing Step A.

━━━ ANSWER FORMAT - MANDATORY ━━━
## [Short Title]
1. **Step one action** - brief explanation
2. **Step two action** - brief explanation
3. **Step three action** - brief explanation
> **Tip:** any helpful note
Never offer demo booking, never call getAvailableSlots or bookDemo.`,

  in_app_audio_override:
`━━━ VOICE MODE — THESE RULES OVERRIDE EVERYTHING ABOVE ━━━
ABSOLUTE PROHIBITION — NEVER output ANY of these in voice mode:
  - Markdown headers: ##, ###  |  Bold/italic: **, __, *, _
  - Bullet symbols: -, *, +    |  Tables: | column |
  - Blockquotes: >             |  Code blocks: \` or \`\`\`

SPEAK LIKE THIS instead:
  - Replace numbered list → say 'First... Second... Third...'
  - Replace bold term → just say the word normally
  - Replace heading → say 'Here is how to...' as an intro sentence
  - Keep answers to 3–5 spoken steps. Short, clear sentences.

LANGUAGE: Detect the language the user spoke and reply in that exact language.
ALWAYS call search_documents first before answering.
Never offer demo booking in the in-app panel.`,

  demo_text_addendum:
`DEMO BOOKING CAPABILITY:
- When the user asks to book, schedule, or see a demo — IMMEDIATELY call getAvailableSlots().
- After getAvailableSlots() returns, reply with ONLY this raw JSON (no extra text before or after):
  {"type":"slot_selection","message":"Great choice! Here are our available demo slots — pick a time that works for you and I'll collect your details.","slots":[{"id":<id>,"label":"<label>"},...]}
- If no slots are returned, respond warmly: "I'm sorry, no demo slots are available right now. Please check back tomorrow or drop us an email at demo@jurinex.com."
- After the user selects a slot and provides their name and email, call bookDemo() immediately to confirm — do not ask the user to fill any form.
- On successful bookDemo(), confirm warmly: "Your demo is confirmed for <slot label>! We'll send details to <email> shortly."`,

  demo_audio_addendum:
`DEMO BOOKING CAPABILITY:
- When the user asks to book or schedule a demo, IMMEDIATELY call getAvailableSlots().
- Read the available slots aloud clearly, e.g.: "We have slots available: Option 1 — Monday, May 5th at 10 AM. Option 2 — Tuesday, May 6th at 2 PM." Then say: "A slot selection panel has appeared on your screen — please tap a slot to choose."
- After the user picks a slot, ask: "What is your full name?" then "What is your email address?" then "Which company are you from?" (optional).
- Once you have name, email and slot, call bookDemo() immediately to confirm the booking.
- Confirm aloud: "Your demo is confirmed! We'll send details to your email shortly."
- If no slots are available, apologise warmly and suggest trying again tomorrow.`,
};

// ─── Shared field components ───────────────────────────────────────────────────

const FieldLabel = ({ children, hint }) => (
  <div className="mb-1.5">
    <span className="block text-sm font-medium text-gray-700">{children}</span>
    {hint && <span className="text-xs text-gray-400">{hint}</span>}
  </div>
);

const SelectInput = ({ value, options, onChange, className = '' }) => (
  <div className="relative">
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent appearance-none bg-white ${className}`}
    >
      {options.map((o) => (
        <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
          {typeof o === 'string' ? o : o.label}
        </option>
      ))}
    </select>
    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
  </div>
);

const RangeSlider = ({ label, hint, value, min, max, step, format, onChange }) => (
  <div>
    <FieldLabel hint={hint}>{label}: <span className="text-indigo-600 font-semibold">{format ? format(value) : value}</span></FieldLabel>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-600"
    />
    <div className="flex justify-between text-xs text-gray-400 mt-0.5"><span>{min}</span><span>{max}</span></div>
  </div>
);

// Style badge for voice cards
const VoiceStyleBadge = ({ style }) => (
  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${VOICE_STYLE_COLORS[style] || 'bg-gray-100 text-gray-600'}`}>
    {style}
  </span>
);

// ─── Accordion for AI Config sections ─────────────────────────────────────────

const Accordion = ({ icon: Icon, iconColor, title, badge, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconColor}`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-gray-800">{title}</span>
          {badge && (
            <span className="text-xs font-medium px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">{badge}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-5 pb-5 pt-1 bg-gray-50 border-t border-gray-100">{children}</div>}
    </div>
  );
};

// ─── Stat Card ─────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, icon: Icon, color, sub, rate }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 shadow-sm hover:shadow-md transition-shadow">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-2xl font-bold text-gray-900 leading-none">{value}</p>
      <p className="text-xs text-gray-500 font-medium mt-1">{label}</p>
      {rate != null && (
        <div className="mt-2">
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(rate, 100)}%` }} />
          </div>
          <p className="text-xs text-emerald-600 font-semibold mt-1">{rate}% Rate</p>
        </div>
      )}
      {sub && <p className="text-xs text-gray-400 mt-1.5">{sub}</p>}
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ── Main Component ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════════

const DocumentManagement = () => {
  const [activeTab, setActiveTab] = useState('documents');

  // ─── Document state ──────────────────────────────────────────────────────────
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState(null);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [searchValue, setSearchValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Upload state
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadType, setUploadType] = useState('general');
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadStage, setUploadStage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState({});
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);
  const dropZoneRef = useRef(null);

  // ─── Usage Analytics state ───────────────────────────────────────────────────
  const [usageData, setUsageData]       = useState(null);
  const [usagePeriod, setUsagePeriod]   = useState('daily');
  const [usageModel, setUsageModel]     = useState('all');
  const [usageLoading, setUsageLoading] = useState(false);
  const [logsLimit, setLogsLimit]       = useState(10);
  const [usageAllModels, setUsageAllModels] = useState([]);
  const [usageError, setUsageError]     = useState(null);

  // ─── Chat History state ──────────────────────────────────────────────────────
  const [chatSessions,     setChatSessions]     = useState([]);
  const [chatTotal,        setChatTotal]        = useState(0);
  const [chatPage,         setChatPage]         = useState(1);
  const [chatModeFilter,   setChatModeFilter]   = useState('all');
  const [chatSearch,       setChatSearch]       = useState('');
  const [chatLoading,      setChatLoading]      = useState(false);
  const [chatError,        setChatError]        = useState(null);
  const [activeSession,    setActiveSession]    = useState(null); // { session, messages }
  const [sessionLoading,   setSessionLoading]   = useState(false);
  const CHAT_PAGE_LIMIT = 20;

  // ─── AI Config state ─────────────────────────────────────────────────────────
  const [cfg, setCfg] = useState(CONFIG_DEFAULTS);
  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [cfgToast, setCfgToast] = useState(null);
  const [voiceStyleFilter, setVoiceStyleFilter] = useState('All');
  const [promptTab, setPromptTab] = useState('landing');
  const [playingVoice,  setPlayingVoice]  = useState(null);
  const [loadingVoice,  setLoadingVoice]  = useState(null);
  const voiceAudioCache = useRef({});
  const voiceAudioRef   = useRef(null);
  const setCfgField = (key) => (val) => setCfg((f) => ({ ...f, [key]: val }));

  const showCfgToast = (type, msg) => {
    setCfgToast({ type, msg });
    setTimeout(() => setCfgToast(null), 3500);
  };

  // ─── Usage helpers ───────────────────────────────────────────────────────────
  const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN'));
  const fmtInr = (n) => (n == null || isNaN(n) ? '—' : `₹${Number(n).toFixed(4)}`);

  // INR pricing rates (mirrors backend .env values)
  const AUDIO_MODELS_SET = new Set([
    'gemini-3.1-flash-live-preview',
    'gemini-2.5-flash-native-audio-preview-12-2025',
  ]);
  const calcCostInr = (modelName, inputTokens, outputTokens) => {
    const isAudio = AUDIO_MODELS_SET.has(modelName);
    const inputRate  = isAudio ? 282    : 28.33;
    const outputRate = isAudio ? 1129   : 236;
    return (Number(inputTokens)  / 1_000_000) * inputRate
         + (Number(outputTokens) / 1_000_000) * outputRate;
  };

  // Use backend cost_inr if available, otherwise calculate from token counts
  const getBreakdownCost = (row) =>
    row.cost_inr != null ? row.cost_inr : calcCostInr(row.model_name, row.total_input, row.total_output);
  const getLogCost = (row) =>
    row.cost_inr != null ? row.cost_inr : calcCostInr(row.model_name, row.input_tokens, row.output_tokens);
  const getTotalCost = (data) => {
    if (data.totals?.total_cost_inr != null) return data.totals.total_cost_inr;
    return (data.model_breakdown ?? []).reduce(
      (sum, r) => sum + calcCostInr(r.model_name, r.total_input, r.total_output), 0
    );
  };

  const USAGE_PERIOD_OPTS = [
    { value: 'daily',   label: 'Today' },
    { value: 'weekly',  label: '7 Days' },
    { value: 'monthly', label: '30 Days' },
    { value: 'yearly',  label: '365 Days' },
    { value: 'all',     label: 'All Time' },
  ];

  const USAGE_MODEL_OPTS = [
    { value: 'all', label: 'All Models' },
    ...usageAllModels.map(m => ({ value: m, label: m })),
  ];

  const fetchUsage = useCallback(async () => {
    setUsageLoading(true);
    setUsageError(null);
    try {
      const token = getToken();
      const qs = new URLSearchParams({ period: usagePeriod, model: usageModel });
      const res = await fetch(`${API_BASE_URL}/admin/chatbot-token-usage/stats?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setUsageData(json.data);
        if (usageModel === 'all' && json.data.model_breakdown?.length) {
          setUsageAllModels([...new Set(json.data.model_breakdown.map(r => r.model_name))]);
        }
      } else {
        setUsageError(json.error || 'Failed to load usage data');
      }
    } catch (err) {
      setUsageError(err.message || 'Failed to load usage data');
    } finally {
      setUsageLoading(false);
    }
  }, [usagePeriod, usageModel]);

  useEffect(() => {
    if (activeTab === 'usage') fetchUsage();
  }, [activeTab, fetchUsage]);

  useEffect(() => { setLogsLimit(10); }, [usagePeriod, usageModel]);

  // ─── Chat history fetch ───────────────────────────────────────────────────────
  const fetchChatSessions = useCallback(async (page = chatPage) => {
    setChatLoading(true);
    setChatError(null);
    try {
      const token = getToken();
      const qs = new URLSearchParams({
        page,
        limit: CHAT_PAGE_LIMIT,
        mode: chatModeFilter,
        search: chatSearch,
      });
      const res = await fetch(`${API_BASE_URL}/admin/chat-history?${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) {
        setChatSessions(json.sessions);
        setChatTotal(json.total);
        setChatPage(page);
      } else {
        setChatError(json.error || 'Failed to load sessions');
      }
    } catch (err) {
      setChatError(err.message || 'Failed to load sessions');
    } finally {
      setChatLoading(false);
    }
  }, [chatModeFilter, chatSearch, chatPage]);

  const fetchSessionMessages = async (sessionId) => {
    setSessionLoading(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE_URL}/admin/chat-history/${sessionId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.success) setActiveSession(json);
      else setChatError(json.error || 'Failed to load messages');
    } catch (err) {
      setChatError(err.message || 'Failed to load messages');
    } finally {
      setSessionLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'chat') fetchChatSessions(1);
  }, [activeTab, chatModeFilter]);

  // ─── Fetch documents ─────────────────────────────────────────────────────────

  const fetchDocuments = useCallback(async () => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const { documents: docs } = await documentService.getAll();
      setDocuments(docs || []);
    } catch (err) {
      setDocsError(err.message || 'Failed to load documents');
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  // Auto-poll while any doc is processing
  useEffect(() => {
    const hasProcessing = documents.some((d) => isProcessing(d.status));
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(fetchDocuments, 8000);
    } else if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [documents, fetchDocuments]);

  // ─── Load AI config on tab switch ────────────────────────────────────────────

  useEffect(() => {
    if (activeTab === 'config' && !cfgLoaded) {
      setCfgLoading(true);
      chatbotConfigService.getConfig()
        .then(({ config }) => {
          if (config) {
            // Merge editable fields; fall back to default when DB returns null/empty.
            const clean = {};
            for (const key of Object.keys(CONFIG_DEFAULTS)) {
              const val = config[key];
              clean[key] = (val !== undefined && val !== null && val !== '')
                ? val
                : CONFIG_DEFAULTS[key];
            }
            setCfg((p) => ({ ...p, ...clean }));
          }
          setCfgLoaded(true); // mark loaded only on success
        })
        .catch((err) => showCfgToast('error', `Failed to load config: ${err.message}`))
        // cfgLoaded stays false on error → retries next time user opens tab
        .finally(() => setCfgLoading(false));
    }
  }, [activeTab, cfgLoaded]);

  // ─── Upload handlers ──────────────────────────────────────────────────────────

  const acceptFile = (file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      MySwal.fire({ icon: 'warning', title: 'PDF only', text: 'Only PDF files are supported.' });
      return;
    }
    setUploadFile(file);
    setUploadProgress(0);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    acceptFile(file);
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploadLoading(true);
    setUploadProgress(0);
    try {
      setUploadStage('signed_url');
      const { signed_url, gcs_input_path, document_id } = await documentService.generateSignedUrl(
        uploadFile.name, uploadFile.type || 'application/pdf'
      );
      setUploadStage('gcs_upload');
      await documentService.uploadToGCS(signed_url, uploadFile, setUploadProgress);
      setUploadStage('processing');
      await documentService.processDocument(gcs_input_path, document_id, uploadType);

      MySwal.fire({
        icon: 'success',
        title: 'Upload successful!',
        text: `"${uploadFile.name}" queued for OCR + embedding.`,
        confirmButtonColor: '#4f46e5',
      });
      setUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await fetchDocuments();
    } catch (err) {
      MySwal.fire({ icon: 'error', title: 'Upload failed', text: err.message || 'Unexpected error.', confirmButtonColor: '#4f46e5' });
    } finally {
      setUploadLoading(false);
      setUploadStage('');
      setUploadProgress(0);
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────────

  const handleDelete = async (docId, docName) => {
    const result = await MySwal.fire({
      title: 'Delete document?',
      text: `"${docName}" will be permanently removed.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;

    setDeleteLoading((p) => ({ ...p, [docId]: true }));
    try {
      await documentService.delete(docId);
      setDocuments((p) => p.filter((d) => d.id !== docId));
      if (selectedDoc?.id === docId) setSelectedDoc(null);
      MySwal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false });
    } catch (err) {
      MySwal.fire({ icon: 'error', title: 'Error', text: err.message });
    } finally {
      setDeleteLoading((p) => ({ ...p, [docId]: false }));
    }
  };

  // ─── Filters & pagination ─────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = documents;
    if (statusFilter !== 'all') list = list.filter((d) => d.status === statusFilter);
    if (typeFilter !== 'all') list = list.filter((d) => d.document_type === typeFilter);
    if (searchValue) {
      const q = searchValue.toLowerCase();
      list = list.filter((d) =>
        d.originalname?.toLowerCase().includes(q) ||
        String(d.id || '').toLowerCase().includes(q) ||
        d.document_type?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [documents, statusFilter, typeFilter, searchValue]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = useMemo(() => filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage), [filtered, currentPage]);

  const counts = useMemo(() => ({
    all: documents.length,
    active: documents.filter((d) => d.status === 'active').length,
    processing: documents.filter((d) => isProcessing(d.status)).length,
    failed: documents.filter((d) => d.status === 'failed').length,
    chunks: documents.reduce((s, d) => s + (d.chunks_count || 0), 0),
  }), [documents]);

  const stageLabel = {
    signed_url: 'Preparing upload…',
    gcs_upload: `Uploading ${uploadProgress}%`,
    processing: 'Starting AI pipeline…',
  };

  // ─── Save config ──────────────────────────────────────────────────────────────

  const handleSaveCfg = async () => {
    // Send only the 13 editable fields — strip any stale DB-only keys (id, updated_at…)
    const payload = {};
    for (const key of Object.keys(CONFIG_DEFAULTS)) payload[key] = cfg[key];

    setCfgSaving(true);
    try {
      const { config } = await chatbotConfigService.updateConfig(payload);
      if (config) {
        const clean = {};
        for (const key of Object.keys(CONFIG_DEFAULTS)) {
          const val = config[key];
          clean[key] = (val !== undefined && val !== null && val !== '')
            ? val
            : CONFIG_DEFAULTS[key];
        }
        setCfg((p) => ({ ...p, ...clean }));
      }
      showCfgToast('success', 'Configuration saved successfully.');
    } catch (err) {
      showCfgToast('error', err.message || 'Failed to save.');
    } finally {
      setCfgSaving(false);
    }
  };

  // ─── Voice preview ───────────────────────────────────────────────────────────
  const handlePlayVoice = async (voiceName) => {
    // Stop any currently playing audio
    if (voiceAudioRef.current) {
      voiceAudioRef.current.pause();
      voiceAudioRef.current = null;
    }
    if (playingVoice === voiceName) {
      setPlayingVoice(null);
      return;
    }

    try {
      setLoadingVoice(voiceName);
      setPlayingVoice(null);

      // Use cached audio if available
      let audioUrl = voiceAudioCache.current[voiceName];
      if (!audioUrl) {
        const token = getToken();
        const res = await fetch(`${API_BASE_URL}/admin/chatbot-config/voice-preview/${voiceName}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Preview failed');
        const bytes = Uint8Array.from(atob(json.data), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: json.mimeType || 'audio/wav' });
        audioUrl = URL.createObjectURL(blob);
        voiceAudioCache.current[voiceName] = audioUrl;
      }

      const audio = new Audio(audioUrl);
      voiceAudioRef.current = audio;
      audio.onended = () => setPlayingVoice(null);
      audio.onerror = () => setPlayingVoice(null);
      await audio.play();
      setPlayingVoice(voiceName);
    } catch (err) {
      showCfgToast('error', `Voice preview failed: ${err.message}`);
    } finally {
      setLoadingVoice(null);
    }
  };

  // ─── Tabs ─────────────────────────────────────────────────────────────────────

  const tabs = [
    { key: 'documents', label: 'Documents',        icon: Database     },
    { key: 'config',    label: 'AI Configuration', icon: Settings2    },
    { key: 'usage',     label: 'Usage Analytics',  icon: BarChart3    },
    { key: 'chat',      label: 'Chat History',     icon: MessageSquare },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Page header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-none">AI Chatbot</h1>
              <p className="text-xs text-gray-400 mt-0.5">Upload → OCR → Chunk → Embed → Vector DB</p>
            </div>
          </div>
          {selectedDoc && (
            <button onClick={() => setSelectedDoc(null)}
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              <ChevronLeft className="w-4 h-4" /> Back to list
            </button>
          )}
        </div>

        {/* ── Tabs ───────────────────────────────────────────────────────────── */}
        <div className="flex border-b border-gray-200">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); setSelectedDoc(null); setActiveSession(null); }}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════
            ── DOCUMENTS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'documents' && !selectedDoc && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard
                label="Total Documents" value={counts.all} icon={FileText} color="bg-indigo-500"
                sub={counts.all > 0 ? `${counts.active} active · ${counts.failed} failed` : 'No documents yet'}
              />
              <StatCard
                label="Active & Indexed" value={counts.active} icon={CheckCircle} color="bg-emerald-500"
                rate={counts.all > 0 ? Math.round((counts.active / counts.all) * 100) : 0}
              />
              <StatCard
                label="Processing Queue" value={counts.processing} icon={Clock} color="bg-blue-500"
                sub={counts.processing === 0 ? 'All queues clear' : `${counts.processing} in pipeline`}
              />
              <StatCard
                label="Total Chunks" value={counts.chunks} icon={Database} color="bg-purple-500"
                sub={counts.active > 0
                  ? `AVG ${Math.round(counts.chunks / counts.active)}/DOC · Ready for vector DB`
                  : 'Ready for vector DB'}
              />
            </div>

            {/* Upload zone */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                    <CloudUpload className="w-3.5 h-3.5 text-white" />
                  </div>
                  Document Ingestion
                </h2>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-yellow-400" /> Secure pipeline
                </span>
              </div>

              {/* Drop zone */}
              <div
                ref={dropZoneRef}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => !uploadLoading && fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                  isDragging
                    ? 'border-indigo-500 bg-indigo-50'
                    : uploadFile
                    ? 'border-emerald-400 bg-emerald-50'
                    : 'border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50'
                } ${uploadLoading ? 'pointer-events-none opacity-70' : ''}`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => acceptFile(e.target.files?.[0])}
                  disabled={uploadLoading}
                />
                {uploadFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-800 max-w-[240px] truncate">{uploadFile.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(uploadFile.size)}</p>
                    </div>
                    {!uploadLoading && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        className="ml-2 p-1 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mb-3">
                      <FileText className="w-7 h-7 text-red-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700">Click to browse or drag PDF here</p>
                    <p className="text-xs text-gray-400 mt-1.5 max-w-xs text-center leading-relaxed">
                      Supports standard and scanned PDFs up to 50MB. Documents are processed asynchronously via secure pipelines.
                    </p>
                  </div>
                )}
              </div>

              {/* Upload progress bar */}
              {uploadLoading && uploadStage === 'gcs_upload' && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Uploading to Google Cloud Storage</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div className="bg-indigo-600 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}

              {/* Controls row */}
              <div className="flex flex-wrap items-end gap-3 mt-5 pt-4 border-t border-gray-100">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Processing Profile</label>
                  <SelectInput value={uploadType} options={DOCUMENT_TYPES} onChange={setUploadType} />
                </div>
                <button
                  onClick={handleUpload}
                  disabled={uploadLoading || !uploadFile}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadLoading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" />{stageLabel[uploadStage] || 'Working…'}</>
                  ) : (
                    <><Upload className="w-4 h-4" />Upload & Process</>
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-400 mt-3 flex items-center gap-1 uppercase tracking-wide font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                File uploads directly to GCS via signed URL — zero server buffering
              </p>
            </div>

            {/* Filter bar */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                {/* Status chips */}
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: 'all',            label: 'All',        count: counts.all },
                    { key: 'active',         label: 'Active',     count: counts.active },
                    { key: 'ocr_processing', label: 'Processing', count: counts.processing },
                    { key: 'failed',         label: 'Failed',     count: counts.failed },
                  ].map(({ key, label, count }) => (
                    <button
                      key={key}
                      onClick={() => { setStatusFilter(key); setCurrentPage(1); }}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                        statusFilter === key
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
                      }`}
                    >
                      {label}
                      <span className={`text-xs font-bold ${statusFilter === key ? 'text-indigo-200' : 'text-gray-400'}`}>
                        {count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Search + type filter + refresh */}
                <div className="flex gap-2 items-center flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                    <input
                      type="text"
                      placeholder="Filter documents…"
                      value={searchValue}
                      onChange={(e) => { setSearchValue(e.target.value); setCurrentPage(1); }}
                      className="pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-48"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                    <select
                      value={typeFilter}
                      onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                      className="pl-7 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 appearance-none bg-white font-medium text-gray-700"
                    >
                      <option value="all">Types</option>
                      {DOCUMENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  </div>
                  <button
                    onClick={fetchDocuments}
                    className="p-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-indigo-600 transition"
                    title="Refresh"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Error banner */}
            {docsError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {docsError}
              </div>
            )}

            {/* Documents table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Document Details', 'Type Profile', 'Pipeline Status', 'Metrics', 'Added / Processed', 'Actions'].map((h) => (
                        <th key={h} className="px-5 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {docsLoading ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600" />
                            <p className="text-sm text-gray-400">Loading documents…</p>
                          </div>
                        </td>
                      </tr>
                    ) : paginated.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-20 text-center">
                          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                          <p className="text-sm font-medium text-gray-500">No documents found</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {searchValue || statusFilter !== 'all' || typeFilter !== 'all'
                              ? 'Try adjusting your filters'
                              : 'Upload a PDF to get started'}
                          </p>
                        </td>
                      </tr>
                    ) : (
                      paginated.map((doc) => (
                        <tr key={doc.id} className="hover:bg-indigo-50/20 transition-colors group border-b border-gray-100 last:border-0">
                          {/* Document Details */}
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-red-50 border border-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                <FileText className="w-4 h-4 text-red-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate max-w-[220px]">{doc.originalname}</p>
                                <p className="text-xs text-gray-400 font-mono truncate max-w-[220px] mt-0.5">{doc.id}</p>
                              </div>
                            </div>
                          </td>
                          {/* Type Profile */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="text-xs font-bold px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md tracking-wide uppercase">
                              {doc.document_type || 'general'}
                            </span>
                          </td>
                          {/* Pipeline Status */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <PipelineStatus status={doc.status} />
                          </td>
                          {/* Metrics (pages + chunks combined) */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            {doc.total_pages != null || doc.chunks_count != null ? (
                              <div className="flex items-center gap-3 text-xs font-semibold text-gray-600">
                                <span>
                                  <span className="text-gray-900">{doc.total_pages ?? '—'}</span>
                                  <span className="text-gray-400 font-normal ml-1">PGS</span>
                                </span>
                                <span className="text-gray-300">·</span>
                                <span>
                                  <span className="text-gray-900">{doc.chunks_count ?? '—'}</span>
                                  <span className="text-gray-400 font-normal ml-1">CHK</span>
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </td>
                          {/* Added / Processed */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="text-xs">
                              <p className="text-gray-700 font-medium">
                                {doc.created_at ? new Date(doc.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                              </p>
                              <p className="text-gray-400 mt-0.5">
                                {doc.created_at ? new Date(doc.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                              </p>
                            </div>
                          </td>
                          {/* Actions */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {doc.status === 'active' && (
                                <button
                                  onClick={() => setSelectedDoc(doc)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition border border-transparent hover:border-indigo-200"
                                  title="View details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(doc.id, doc.originalname)}
                                disabled={deleteLoading[doc.id]}
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition border border-transparent hover:border-red-200 disabled:opacity-40"
                                title="Delete"
                              >
                                {deleteLoading[doc.id]
                                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                                  : <Trash2 className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!docsLoading && (
                <div className="px-5 py-3.5 flex items-center justify-between border-t border-gray-100 bg-gray-50/60">
                  <p className="text-xs text-gray-500">
                    {filtered.length === 0
                      ? 'No results'
                      : `Showing ${(currentPage - 1) * itemsPerPage + 1} to ${Math.min(currentPage * itemsPerPage, filtered.length)} of ${filtered.length} results`}
                  </p>
                  {filtered.length > itemsPerPage && (
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-600 hover:bg-white disabled:opacity-40"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Prev
                      </button>
                      <span className="px-3 py-1.5 text-xs text-gray-500">{currentPage} / {totalPages}</span>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-600 hover:bg-white disabled:opacity-40"
                      >
                        Next <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Document detail view ─────────────────────────────────────────────── */}
        {activeTab === 'documents' && selectedDoc && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedDoc.originalname}</h2>
                <p className="text-xs font-mono text-gray-400 mt-0.5">{selectedDoc.id}</p>
              </div>
              <StatusBadge status={selectedDoc.status} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { label: 'Document Type',  value: <span className="capitalize">{selectedDoc.document_type || 'general'}</span> },
                { label: 'Total Pages',    value: selectedDoc.total_pages ?? '—' },
                { label: 'Total Chunks',   value: selectedDoc.chunks_count ?? '—' },
                { label: 'Ready for Chat', value: selectedDoc.ready_for_chat ? '✅ Yes' : '❌ No' },
                { label: 'Uploaded',       value: formatDate(selectedDoc.created_at) },
                { label: 'Updated',        value: formatDate(selectedDoc.updated_at) },
              ].map(({ label, value }) => (
                <div key={label} className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
                  <div className="text-sm font-semibold text-gray-900">{value}</div>
                </div>
              ))}
            </div>

            {selectedDoc.gcs_input_path && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">GCS Input Path</p>
                <p className="text-xs font-mono text-gray-700 bg-gray-50 border border-gray-200 p-2.5 rounded-lg break-all">
                  {selectedDoc.gcs_input_path}
                </p>
              </div>
            )}

            {selectedDoc.error_message && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-600 mb-1">Error</p>
                <p className="text-sm text-red-700">{selectedDoc.error_message}</p>
              </div>
            )}

            <div className="pt-2 border-t flex gap-3">
              <button
                onClick={() => setSelectedDoc(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                ← Back
              </button>
              <button
                onClick={() => handleDelete(selectedDoc.id, selectedDoc.originalname)}
                disabled={deleteLoading[selectedDoc.id]}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleteLoading[selectedDoc.id]
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            ── AI CONFIG TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'config' && (
          <div className="space-y-5">

            {/* ── Action Bar ──────────────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm flex-shrink-0">
                  <Settings2 className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">AI Configuration</p>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100 whitespace-nowrap">
                      <Cpu className="w-2.5 h-2.5 flex-shrink-0" />{cfg.model_text}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-mono bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md border border-purple-100 whitespace-nowrap">
                      <Mic className="w-2.5 h-2.5 flex-shrink-0" />{cfg.model_audio}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-violet-50 text-violet-700 px-2 py-0.5 rounded-md border border-violet-100 whitespace-nowrap">
                      <Volume2 className="w-2.5 h-2.5 flex-shrink-0" />{cfg.voice_name}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {cfgToast && (
                  <div className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border ${
                    cfgToast.type === 'success'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {cfgToast.type === 'success'
                      ? <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
                    <span className="hidden sm:inline max-w-[200px] truncate">{cfgToast.msg}</span>
                  </div>
                )}
                <button
                  onClick={() => { setCfg(CONFIG_DEFAULTS); showCfgToast('success', 'Reset to defaults — click Save to apply.'); }}
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
                <button
                  onClick={handleSaveCfg}
                  disabled={cfgSaving || cfgLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm disabled:opacity-60"
                >
                  {cfgSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {cfgSaving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* Loading */}
            {cfgLoading && (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600" />
                  <p className="text-sm text-gray-400">Loading configuration…</p>
                </div>
              </div>
            )}

            {!cfgLoading && (
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">

                {/* ── LEFT COLUMN: Parameter Panels ────────────────────────── */}
                <div className="xl:col-span-2 space-y-4">

                  {/* Text Chat Card */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-blue-50/40">
                      <div className="w-6 h-6 rounded-md bg-blue-500 flex items-center justify-center flex-shrink-0">
                        <Cpu className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs font-bold text-gray-800">Text Chat</span>
                      <span className="ml-auto text-[11px] font-mono text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded truncate max-w-[160px]">{cfg.model_text}</span>
                    </div>
                    <div className="p-4 space-y-4">

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Model</label>
                        <SelectInput value={cfg.model_text} options={GEMINI_TEXT_MODELS} onChange={setCfgField('model_text')} />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                          Max Response Tokens
                        </label>
                        <div className="flex gap-2 items-center">
                          <input type="number" min={1} max={8192} step={16} value={cfg.max_tokens}
                            onChange={(e) => setCfgField('max_tokens')(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50/60" />
                          <span className="text-[11px] text-gray-400 whitespace-nowrap">/ 8192</span>
                        </div>
                      </div>

                      {[
                        { key: 'temperature', label: 'Temperature', min: 0, max: 2, step: 0.01, fmt: v => v.toFixed(2), hint: ['Factual', 'Creative'] },
                        { key: 'top_p',       label: 'Top P',        min: 0, max: 1, step: 0.01, fmt: v => v.toFixed(2), hint: ['Low', 'High'] },
                      ].map(({ key, label, min, max, step, fmt, hint }) => (
                        <div key={key}>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
                            <span className="text-xs font-bold text-blue-600 tabular-nums">{fmt(cfg[key])}</span>
                          </div>
                          <input type="range" min={min} max={max} step={step} value={cfg[key]}
                            onChange={(e) => setCfgField(key)(Number(e.target.value))}
                            className="w-full accent-blue-600 cursor-pointer h-1.5" />
                          <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                            <span>{hint[0]}</span><span>{hint[1]}</span>
                          </div>
                        </div>
                      ))}

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">RAG Results</label>
                          <span className="text-xs font-bold text-blue-600 tabular-nums">{cfg.top_k_results} chunks</span>
                        </div>
                        <input type="range" min={1} max={20} step={1} value={cfg.top_k_results}
                          onChange={(e) => setCfgField('top_k_results')(Number(e.target.value))}
                          className="w-full accent-blue-600 cursor-pointer h-1.5" />
                        <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                          <span>1</span><span>20</span>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Voice Chat Card */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-purple-50/40">
                      <div className="w-6 h-6 rounded-md bg-purple-500 flex items-center justify-center flex-shrink-0">
                        <Mic className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs font-bold text-gray-800">Voice Chat</span>
                      <span className="ml-auto text-[11px] font-mono text-purple-600 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded truncate max-w-[160px]">{cfg.model_audio}</span>
                    </div>
                    <div className="p-4 space-y-4">

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Model</label>
                        <SelectInput value={cfg.model_audio} options={GEMINI_LIVE_MODELS} onChange={setCfgField('model_audio')} />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Language Code</label>
                        <input type="text" placeholder="en-US" value={cfg.language_code ?? 'en-US'}
                          onChange={(e) => setCfgField('language_code')(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-gray-50/60" />
                        <p className="text-[11px] text-gray-400 mt-1">BCP-47 · e.g. en-US, hi-IN, mr-IN</p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Speaking Rate</label>
                          <span className="text-xs font-bold text-purple-600 tabular-nums">{(cfg.speaking_rate ?? 1.0).toFixed(2)}×</span>
                        </div>
                        <input type="range" min={0.25} max={4.0} step={0.05} value={cfg.speaking_rate ?? 1.0}
                          onChange={(e) => setCfgField('speaking_rate')(Number(e.target.value))}
                          className="w-full accent-purple-600 cursor-pointer h-1.5" />
                        <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                          <span>0.25× Slow</span><span>1.0 Normal</span><span>4.0× Fast</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Pitch</label>
                          <span className="text-xs font-bold text-purple-600 tabular-nums">
                            {(cfg.pitch ?? 0) >= 0 ? `+${(cfg.pitch ?? 0).toFixed(1)}` : (cfg.pitch ?? 0).toFixed(1)} st
                          </span>
                        </div>
                        <input type="range" min={-20} max={20} step={0.5} value={cfg.pitch ?? 0}
                          onChange={(e) => setCfgField('pitch')(Number(e.target.value))}
                          className="w-full accent-purple-600 cursor-pointer h-1.5" />
                        <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                          <span>−20 Low</span><span>0 Natural</span><span>+20 High</span>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Volume Gain</label>
                          <span className="text-xs font-bold text-purple-600 tabular-nums">
                            {(cfg.volume_gain_db ?? 0) >= 0 ? `+${(cfg.volume_gain_db ?? 0).toFixed(1)}` : (cfg.volume_gain_db ?? 0).toFixed(1)} dB
                          </span>
                        </div>
                        <input type="range" min={-96} max={16} step={0.5} value={cfg.volume_gain_db ?? 0}
                          onChange={(e) => setCfgField('volume_gain_db')(Number(e.target.value))}
                          className="w-full accent-purple-600 cursor-pointer h-1.5" />
                        <div className="flex justify-between text-[11px] text-gray-400 mt-1">
                          <span>−96 dB</span><span>0 Normal</span><span>+16 dB</span>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>

                {/* ── RIGHT COLUMN: Voice Picker + Prompts ─────────────────── */}
                <div className="xl:col-span-3 space-y-4">

                  {/* Voice Picker */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-violet-50/40 flex-wrap gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-md bg-violet-500 flex items-center justify-center flex-shrink-0">
                          <Volume2 className="w-3 h-3 text-white" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-gray-800">AI Voice</span>
                          <span className="ml-2 text-[11px] text-gray-400">Active: <span className="font-bold text-violet-600">{cfg.voice_name}</span></span>
                        </div>
                      </div>
                      <div className="relative">
                        <select value={voiceStyleFilter} onChange={(e) => setVoiceStyleFilter(e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg pl-3 pr-7 py-1.5 bg-white font-medium text-gray-600 focus:ring-2 focus:ring-violet-500 appearance-none cursor-pointer">
                          {['All','Upbeat','Bright','Breezy','Excitable','Youthful','Firm','Informational','Clear','Easygoing','Smooth','Soft','Gentle','Warm','Friendly','Lively','Casual','Knowledgeable','Even','Breathy','Gravelly','Mature','Forward'].map(s => (
                            <option key={s} value={s}>{s === 'All' ? 'All Styles' : s}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                    <div className="p-4">
                      <p className="text-[11px] text-gray-400 mb-3">Click a card to select · <Volume2 className="inline w-3 h-3 mb-0.5" /> to preview (cached after first play)</p>
                      <div className="grid grid-cols-4 sm:grid-cols-5 lg:grid-cols-6 gap-2 max-h-64 overflow-y-auto pr-0.5">
                        {VOICE_OPTIONS
                          .filter(v => voiceStyleFilter === 'All' || v.style === voiceStyleFilter)
                          .map(({ value, style }) => {
                            const isSelected = cfg.voice_name === value;
                            const isPlaying  = playingVoice === value;
                            const isLoading  = loadingVoice === value;
                            return (
                              <div
                                key={value}
                                onClick={() => setCfgField('voice_name')(value)}
                                className={`relative flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 cursor-pointer transition-all select-none group ${
                                  isSelected
                                    ? 'border-violet-500 bg-violet-50'
                                    : 'border-transparent bg-gray-50 hover:border-violet-200 hover:bg-violet-50/40'
                                }`}
                              >
                                {isSelected && (
                                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center shadow">
                                    <CheckCircle className="w-2.5 h-2.5 text-white" />
                                  </div>
                                )}
                                <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
                                  isSelected ? 'bg-violet-500' : 'bg-white border border-gray-200 group-hover:border-violet-300'
                                }`}>
                                  <Mic className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-gray-400'}`} />
                                </div>
                                <p className={`text-[11px] font-bold text-center truncate w-full leading-tight ${isSelected ? 'text-violet-700' : 'text-gray-800'}`}>{value}</p>
                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-tight whitespace-nowrap ${
                                  isSelected ? 'bg-violet-100 text-violet-600' : 'bg-gray-100 text-gray-500'
                                }`}>{style}</span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handlePlayVoice(value); }}
                                  disabled={isLoading}
                                  title={isPlaying ? 'Stop' : 'Preview'}
                                  className={`w-full flex items-center justify-center gap-1 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                                    isPlaying  ? 'bg-emerald-500 text-white border-emerald-500' :
                                    isLoading  ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-wait' :
                                    isSelected ? 'bg-violet-100 text-violet-700 border-violet-200 hover:bg-violet-200' :
                                                 'bg-white text-gray-500 border-gray-200 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200'
                                  }`}
                                >
                                  {isLoading ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> :
                                   isPlaying  ? <Volume2 className="w-2.5 h-2.5" /> :
                                                <Volume2 className="w-2.5 h-2.5" />}
                                </button>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  </div>

                  {/* System Prompts — Tabbed */}
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-gray-100 bg-emerald-50/40">
                      <div className="w-6 h-6 rounded-md bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <MessageSquare className="w-3 h-3 text-white" />
                      </div>
                      <span className="text-xs font-bold text-gray-800">System Prompts</span>
                      <span className="text-[11px] text-gray-400 ml-1">6 prompts · 3 modes</span>
                    </div>

                    {/* Tab bar */}
                    <div className="flex border-b border-gray-100 bg-gray-50/40">
                      {[
                        { key: 'landing', label: 'Landing Page',  activeClass: 'border-blue-500 text-blue-600',    dot: 'bg-blue-500'    },
                        { key: 'panel',   label: 'App Panel',     activeClass: 'border-emerald-500 text-emerald-600', dot: 'bg-emerald-500' },
                        { key: 'demo',    label: 'Demo Booking',  activeClass: 'border-orange-500 text-orange-600',  dot: 'bg-orange-500'  },
                      ].map(({ key, label, activeClass, dot }) => (
                        <button key={key} onClick={() => setPromptTab(key)}
                          className={`flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold border-b-2 transition-colors ${
                            promptTab === key ? activeClass : 'border-transparent text-gray-400 hover:text-gray-700'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${promptTab === key ? dot : 'bg-gray-300'}`} />
                          {label}
                        </button>
                      ))}
                    </div>

                    <div className="p-4 space-y-4">
                      {(() => {
                        const prompts = {
                          landing: [
                            { num: 1, label: 'Text Chat',   hint: 'landing_page_agent — typed legal Q&A on public site',                   key: 'system_prompt',       ring: 'focus:ring-blue-500',    rows: 8  },
                            { num: 2, label: 'Voice Mode',  hint: 'handle_audio_session (landing) — Gemini Live voice guide',              key: 'audio_system_prompt', ring: 'focus:ring-blue-500',    rows: 7  },
                          ],
                          panel: [
                            { num: 3, label: 'Text Chat',   hint: 'app_panel_agent — base for in-app text & audio',                        key: 'in_app_system_prompt',  ring: 'focus:ring-emerald-500', rows: 10 },
                            { num: 4, label: 'Voice Override', hint: 'Appended in voice mode — strips Markdown, enforces spoken style',     key: 'in_app_audio_override', ring: 'focus:ring-emerald-500', rows: 7  },
                          ],
                          demo: [
                            { num: 5, label: 'Text',        hint: 'Appended to Landing Text — enables getAvailableSlots / bookDemo calls',  key: 'demo_text_addendum',  ring: 'focus:ring-orange-500',  rows: 8  },
                            { num: 6, label: 'Voice',       hint: 'Appended to Landing Voice — voice-friendly booking instructions',        key: 'demo_audio_addendum', ring: 'focus:ring-orange-500',  rows: 8  },
                          ],
                        };
                        return prompts[promptTab].map(({ num, label, hint, key, ring, rows }) => (
                          <div key={key}>
                            <div className="flex items-center justify-between mb-1.5">
                              <label className="text-xs font-semibold text-gray-700">
                                <span className="text-gray-400 font-mono mr-1">{num}.</span>{label}
                              </label>
                              <span className="text-[11px] text-gray-400 tabular-nums font-mono">{(cfg[key] ?? '').length} ch</span>
                            </div>
                            <p className="text-[11px] text-gray-400 mb-1.5">{hint}</p>
                            <textarea rows={rows} value={cfg[key] ?? ''}
                              onChange={(e) => setCfgField(key)(e.target.value)}
                              className={`w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono ${ring} focus:ring-2 focus:border-transparent resize-y bg-gray-50/60 leading-relaxed`}
                            />
                          </div>
                        ));
                      })()}
                    </div>
                  </div>

                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            ── USAGE ANALYTICS TAB ───────────────────────────────────────────── */}
        {activeTab === 'usage' && (
          <div className="space-y-5">

            {/* ── Filter bar ──────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Period pills */}
              <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
                {USAGE_PERIOD_OPTS.map(b => (
                  <button
                    key={b.value}
                    onClick={() => setUsagePeriod(b.value)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                      usagePeriod === b.value
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              {/* Model + Refresh */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={usageModel}
                    onChange={e => setUsageModel(e.target.value)}
                    className="pl-3 pr-8 py-2 border border-gray-300 rounded-lg text-sm font-medium bg-white focus:ring-2 focus:ring-indigo-500 appearance-none min-w-[140px]"
                  >
                    {USAGE_MODEL_OPTS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
                <button
                  onClick={fetchUsage}
                  disabled={usageLoading}
                  className="p-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-indigo-600 transition disabled:opacity-50"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${usageLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Error */}
            {usageError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />{usageError}
              </div>
            )}

            {/* Loading */}
            {usageLoading && !usageData && (
              <div className="flex items-center justify-center py-24">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600" />
                  <p className="text-sm text-gray-400">Loading analytics…</p>
                </div>
              </div>
            )}

            {/* ── Data ──────────────────────────────────────────────────────────── */}
            {usageData && (
              <>
                {/* ── Big stat cards ──────────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: 'Total Input Tokens',
                      value: fmtNum(usageData.totals?.total_input),
                      icon: TrendingUp,
                      gradient: 'from-blue-500 to-blue-600',
                      bg: 'bg-blue-50',
                    },
                    {
                      label: 'Total Output Tokens',
                      value: fmtNum(usageData.totals?.total_output),
                      icon: Activity,
                      gradient: 'from-violet-500 to-purple-600',
                      bg: 'bg-purple-50',
                    },
                    {
                      label: 'Total Tokens',
                      value: fmtNum(usageData.totals?.total_all),
                      icon: Zap,
                      gradient: 'from-cyan-500 to-blue-500',
                      bg: 'bg-cyan-50',
                    },
                    {
                      label: 'Total Cost (₹)',
                      value: fmtInr(getTotalCost(usageData)),
                      icon: BarChart3,
                      gradient: 'from-emerald-500 to-green-600',
                      bg: 'bg-emerald-50',
                    },
                  ].map(({ label, value, icon: Icon, gradient, bg }) => (
                    <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-gray-900 tracking-tight leading-none">{value}</p>
                      <p className="text-xs text-gray-500 font-medium mt-1.5">{label}</p>
                    </div>
                  ))}
                </div>

                {/* Pricing note */}
                <p className="text-xs text-gray-400 flex items-center gap-1.5">
                  <span className="font-semibold text-gray-600">{fmtNum(usageData.totals?.total_requests)} total requests</span>
                  <span>·</span>
                  Pricing: ₹28.33/M input, ₹236/M output (text) · ₹282/M input, ₹1,129/M output (audio)
                </p>

                {/* ── Model Breakdown ──────────────────────────────────────────── */}
                {usageData.model_breakdown?.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-100">
                      <h3 className="text-sm font-bold text-gray-900">Model Breakdown</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100">
                            {['Model', 'Mode', 'Requests', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Cost (₹)'].map(h => (
                              <th key={h} className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {usageData.model_breakdown.map((row) => (
                            <tr key={`${row.model_name}-${row.mode}`} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-6 py-4 text-sm font-semibold text-gray-900 whitespace-nowrap">{row.model_name}</td>
                              <td className="px-6 py-4">
                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${
                                  row.mode === 'audio'
                                    ? 'bg-purple-100 text-purple-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {row.mode}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-700 tabular-nums">{fmtNum(row.request_count)}</td>
                              <td className="px-6 py-4 text-sm text-gray-700 tabular-nums">{fmtNum(row.total_input)}</td>
                              <td className="px-6 py-4 text-sm text-gray-700 tabular-nums">{fmtNum(row.total_output)}</td>
                              <td className="px-6 py-4 text-sm font-bold text-gray-900 tabular-nums">{fmtNum(row.total_all)}</td>
                              <td className="px-6 py-4 text-sm font-bold text-emerald-600 tabular-nums">+{fmtInr(getBreakdownCost(row))}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-gray-200 bg-gray-50">
                            <td colSpan={2} className="px-6 py-4 text-sm font-bold text-indigo-700">Grand Total</td>
                            <td className="px-6 py-4 text-sm font-bold text-indigo-700 tabular-nums">{fmtNum(usageData.totals?.total_requests)}</td>
                            <td className="px-6 py-4 text-sm font-bold text-indigo-700 tabular-nums">{fmtNum(usageData.totals?.total_input)}</td>
                            <td className="px-6 py-4 text-sm font-bold text-indigo-700 tabular-nums">{fmtNum(usageData.totals?.total_output)}</td>
                            <td className="px-6 py-4 text-sm font-bold text-indigo-700 tabular-nums">{fmtNum(usageData.totals?.total_all)}</td>
                            <td className="px-6 py-4 text-sm font-bold text-emerald-600 tabular-nums">+{fmtInr(getTotalCost(usageData))}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── Recent Logs ───────────────────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      Recent Logs
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </h3>
                    {usageData.logs?.length > 0 && (
                      <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                        {usageData.logs.length} entries
                      </span>
                    )}
                  </div>

                  {!usageData.logs?.length ? (
                    <div className="px-6 py-16 text-center">
                      <BarChart3 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm text-gray-400">No records for the selected period / model.</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/60">
                              {['#', 'Time', 'Mode', 'Model', 'Input', 'Output', 'Total', 'Cost (₹)', 'IP'].map(h => (
                                <th key={h} className="px-5 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {usageData.logs.slice(0, logsLimit).map((row, i) => (
                              <tr key={row.id} className="hover:bg-gray-50/40 transition-colors">
                                <td className="px-5 py-3 text-xs text-gray-400 tabular-nums">{i + 1}</td>
                                <td className="px-5 py-3 text-xs text-gray-600 whitespace-nowrap tabular-nums">
                                  {new Date(row.created_at).toLocaleString('en-IN', {
                                    day: 'numeric', month: 'numeric', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit', hour12: true,
                                  })}
                                </td>
                                <td className="px-5 py-3">
                                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wide ${
                                    row.mode === 'audio'
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {row.mode}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-xs font-semibold text-gray-800 whitespace-nowrap">{row.model_name}</td>
                                <td className="px-5 py-3 text-xs text-gray-600 tabular-nums">{fmtNum(row.input_tokens)}</td>
                                <td className="px-5 py-3 text-xs text-gray-600 tabular-nums">{fmtNum(row.output_tokens)}</td>
                                <td className="px-5 py-3 text-xs font-bold text-gray-900 tabular-nums">{fmtNum(row.total_tokens)}</td>
                                <td className="px-5 py-3 text-xs font-bold text-emerald-600 tabular-nums">+{fmtInr(getLogCost(row))}</td>
                                <td className="px-5 py-3 text-xs text-gray-400">{row.ip_address || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Load older logs */}
                      {logsLimit < usageData.logs.length && (
                        <div className="px-6 py-4 border-t border-gray-100 text-center">
                          <button
                            onClick={() => setLogsLimit(prev => prev + 10)}
                            className="text-sm text-indigo-500 hover:text-indigo-700 font-semibold transition-colors inline-flex items-center gap-1"
                          >
                            Load older logs ↓
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            ── CHAT HISTORY TAB ──────────────────────────────────────────────── */}
        {activeTab === 'chat' && (
          <div className="space-y-4">

            {/* ── Session detail view ───────────────────────────────────────── */}
            {activeSession ? (
              <div className="space-y-4">
                {/* Back + meta + CSV download */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <button
                    onClick={() => setActiveSession(null)}
                    className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                  >
                    <ChevronLeft className="w-4 h-4" /> Back to Sessions
                  </button>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${
                        activeSession.session.mode === 'audio'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {activeSession.session.mode}
                      </span>
                      <span className="font-mono text-gray-400 truncate max-w-[180px]">{activeSession.session.id}</span>
                      <span>{new Date(activeSession.session.created_at).toLocaleString('en-IN')}</span>
                      <span className="font-semibold text-gray-700">{activeSession.messages.length} messages</span>
                    </div>
                    <button
                      onClick={() => {
                        const s = activeSession.session;
                        // Build paired turns for CSV
                        const msgs = activeSession.messages;
                        const csvTurns = [];
                        let ci = 0;
                        while (ci < msgs.length) {
                          const u = msgs[ci]?.role === 'user' ? msgs[ci] : null;
                          const a = msgs[ci + 1]?.role === 'assistant' ? msgs[ci + 1]
                                  : msgs[ci]?.role === 'assistant' ? msgs[ci] : null;
                          csvTurns.push({ u, a });
                          ci += (u && a) ? 2 : 1;
                        }
                        const rows = [
                          ['#', 'User Message', 'AI Response', 'Timestamp'],
                          ...csvTurns.map((t, i) => [
                            i + 1,
                            `"${(t.u?.content || '').replace(/"/g, '""')}"`,
                            `"${(t.a?.content || '').replace(/"/g, '""')}"`,
                            t.u ? new Date(t.u.created_at).toLocaleString('en-IN') : '',
                          ]),
                        ];
                        const csv = rows.map(r => r.join(',')).join('\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = `chat-session-${s.id.slice(0, 8)}.csv`;
                        a.click();
                        URL.revokeObjectURL(a.href);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition"
                    >
                      <FileUp className="w-3.5 h-3.5" /> Download CSV
                    </button>
                  </div>
                </div>

                {/* Messages table — paired rows (user + assistant per turn) */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {sessionLoading ? (
                    <div className="flex items-center justify-center py-20">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
                    </div>
                  ) : activeSession.messages.length === 0 ? (
                    <div className="py-16 text-center text-sm text-gray-400">No messages in this session.</div>
                  ) : (() => {
                      // Pair messages into turns: each turn = { user, assistant }
                      const turns = [];
                      const msgs = activeSession.messages;
                      let i = 0;
                      while (i < msgs.length) {
                        const user = msgs[i]?.role === 'user' ? msgs[i] : null;
                        const asst = msgs[i + 1]?.role === 'assistant' ? msgs[i + 1]
                                   : msgs[i]?.role === 'assistant'     ? msgs[i]
                                   : null;
                        if (user) {
                          turns.push({ user, assistant: asst });
                          i += asst ? 2 : 1;
                        } else {
                          turns.push({ user: null, assistant: asst });
                          i += 1;
                        }
                      }
                      return (
                        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
                          <table className="w-full text-sm border-collapse">
                            <thead className="bg-gray-50 sticky top-0 z-10">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap w-10">#</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-blue-600 uppercase tracking-wide">User Message</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-600 uppercase tracking-wide">AI Response</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Time</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {turns.map((turn, idx) => (
                                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                  <td className="px-4 py-3 text-xs text-gray-400 align-top">{idx + 1}</td>
                                  <td className="px-4 py-3 align-top max-w-xs">
                                    {turn.user ? (
                                      <p className="text-sm text-gray-800 whitespace-pre-wrap break-words leading-relaxed">
                                        {turn.user.content}
                                      </p>
                                    ) : <span className="text-xs text-gray-300 italic">—</span>}
                                  </td>
                                  <td className="px-4 py-3 align-top max-w-lg">
                                    {turn.assistant ? (
                                      <p className="text-sm text-indigo-900 whitespace-pre-wrap break-words leading-relaxed">
                                        {turn.assistant.content}
                                      </p>
                                    ) : <span className="text-xs text-gray-300 italic">—</span>}
                                  </td>
                                  <td className="px-4 py-3 text-xs text-gray-400 align-top whitespace-nowrap">
                                    {turn.user
                                      ? new Date(turn.user.created_at).toLocaleString('en-IN')
                                      : turn.assistant
                                      ? new Date(turn.assistant.created_at).toLocaleString('en-IN')
                                      : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                  })()}
                </div>
              </div>
            ) : (
              /* ── Sessions list ──────────────────────────────────────────────── */
              <>
                {/* ── Page header + controls ──────────────────────────────────── */}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
                      Session Log
                      {chatTotal > 0 && (
                        <span className="text-sm font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2.5 py-0.5 rounded-lg">
                          Total: {chatTotal}
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                      Review and audit all historical{' '}
                      <span className="text-indigo-500 font-medium">AI interactions</span>{' '}
                      across modes.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Segmented mode control */}
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                      {[
                        { value: 'all',   label: 'All Modes' },
                        { value: 'text',  label: 'Text' },
                        { value: 'audio', label: 'Audio' },
                      ].map(b => (
                        <button
                          key={b.value}
                          onClick={() => { setChatModeFilter(b.value); setChatPage(1); }}
                          className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                            chatModeFilter === b.value
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search session ID or content"
                        value={chatSearch}
                        onChange={e => setChatSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && fetchChatSessions(1)}
                        className="pl-9 pr-10 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-60"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-300 font-mono hidden sm:block">⌘K</span>
                    </div>

                    {/* Refresh */}
                    <button
                      onClick={() => fetchChatSessions(1)}
                      disabled={chatLoading}
                      className="p-2 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-indigo-600 transition disabled:opacity-50"
                      title="Refresh"
                    >
                      <RefreshCw className={`w-4 h-4 ${chatLoading ? 'animate-spin' : ''}`} />
                    </button>

                    {/* Export CSV */}
                    <button
                      disabled={chatSessions.length === 0}
                      onClick={() => {
                        const csvRows = [
                          ['#', 'Session ID', 'Mode', 'Messages', 'Last User Message', 'Started', 'Last Active'],
                          ...chatSessions.map((s, i) => [
                            i + 1, s.id, s.mode, s.message_count,
                            `"${(s.last_user_message || '').replace(/"/g, '""')}"`,
                            new Date(s.created_at).toLocaleString('en-IN'),
                            s.last_active_at ? new Date(s.last_active_at).toLocaleString('en-IN') : '',
                          ]),
                        ];
                        const csv = csvRows.map(r => r.join(',')).join('\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(blob);
                        a.download = `chat-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
                        a.click();
                        URL.revokeObjectURL(a.href);
                      }}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    >
                      <FileUp className="w-4 h-4" /> Export CSV
                    </button>
                  </div>
                </div>

                {/* Error */}
                {chatError && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />{chatError}
                  </div>
                )}

                {/* ── Sessions table card ──────────────────────────────────────── */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {chatLoading ? (
                    <div className="flex items-center justify-center py-24">
                      <div className="flex flex-col items-center gap-3">
                        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600" />
                        <p className="text-sm text-gray-400">Loading sessions…</p>
                      </div>
                    </div>
                  ) : chatSessions.length === 0 ? (
                    <div className="py-20 text-center">
                      <MessageSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm font-medium text-gray-500">No chat sessions found</p>
                      <p className="text-xs text-gray-400 mt-1">Try changing the mode filter or search term</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-100 bg-gray-50/60">
                            {['#', 'Session ID', 'Mode', 'Messages', 'Last Message Preview', 'Started', 'Last Active', 'Actions'].map(h => (
                              <th key={h} className="px-5 py-3.5 text-left text-xs font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {chatSessions.map((s, i) => {
                            const startedDate = new Date(s.created_at);
                            const activeDate  = s.last_active_at ? new Date(s.last_active_at) : null;
                            const fmtDt = (d) => d ? {
                              date: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'numeric', year: 'numeric' }),
                              time: d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
                            } : null;
                            const started = fmtDt(startedDate);
                            const active  = fmtDt(activeDate);
                            const preview = s.last_user_message || s.last_message || '';
                            const msgRole = s.last_message_role || 'user';
                            const roleMeta = {
                              user:      { tag: 'USER',        cls: 'bg-teal-50 text-teal-700 border-teal-200' },
                              assistant: { tag: 'AI',          cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
                              system:    { tag: 'SYS',         cls: 'bg-orange-50 text-orange-600 border-orange-200' },
                              context:   { tag: 'APP CONTEXT', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
                            }[msgRole] || { tag: 'USER', cls: 'bg-teal-50 text-teal-700 border-teal-200' };

                            return (
                              <tr
                                key={s.id}
                                className="hover:bg-indigo-50/20 transition-colors cursor-pointer group"
                                onClick={() => fetchSessionMessages(s.id)}
                              >
                                {/* # */}
                                <td className="px-5 py-4 text-sm text-gray-400 tabular-nums">
                                  {(chatPage - 1) * CHAT_PAGE_LIMIT + i + 1}
                                </td>
                                {/* Session ID */}
                                <td className="px-5 py-4">
                                  <span className="text-sm font-mono text-gray-700">
                                    {s.id.length > 20 ? `${s.id.slice(0, 20)}...` : s.id}
                                  </span>
                                </td>
                                {/* Mode */}
                                <td className="px-5 py-4 whitespace-nowrap">
                                  {s.mode === 'audio' ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
                                      <Mic className="w-3 h-3" /> AUDIO
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> TEXT
                                    </span>
                                  )}
                                </td>
                                {/* Messages */}
                                <td className="px-5 py-4 text-sm font-semibold text-gray-800 tabular-nums">
                                  {s.message_count}
                                </td>
                                {/* Last Message Preview */}
                                <td className="px-5 py-4 max-w-xs">
                                  {preview ? (
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span className={`flex-shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${roleMeta.cls} uppercase tracking-wide`}>
                                        {roleMeta.tag}
                                      </span>
                                      <p className="text-sm text-gray-600 truncate">{preview}</p>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-300 italic">No messages</span>
                                  )}
                                </td>
                                {/* Started */}
                                <td className="px-5 py-4 whitespace-nowrap">
                                  <p className="text-xs text-gray-700 font-medium">{started?.date}</p>
                                  <p className="text-xs text-gray-400 mt-0.5">{started?.time}</p>
                                </td>
                                {/* Last Active */}
                                <td className="px-5 py-4 whitespace-nowrap">
                                  {active ? (
                                    <div className="flex items-start gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                                      <div>
                                        <p className="text-xs text-gray-700 font-medium">{active.date}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{active.time}</p>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-300">—</span>
                                  )}
                                </td>
                                {/* Actions */}
                                <td className="px-5 py-4">
                                  <button
                                    className="p-1.5 rounded-lg text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition border border-transparent hover:border-indigo-200"
                                    title="View session"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ── Pagination footer ──────────────────────────────────────── */}
                  {!chatLoading && chatTotal > 0 && (
                    <div className="px-6 py-4 flex items-center justify-between border-t border-gray-100 bg-gray-50/40">
                      <p className="text-sm text-gray-500">
                        Showing{' '}
                        <strong className="text-gray-800 font-semibold">{(chatPage - 1) * CHAT_PAGE_LIMIT + 1}</strong>
                        {' '}to{' '}
                        <strong className="text-gray-800 font-semibold">{Math.min(chatPage * CHAT_PAGE_LIMIT, chatTotal)}</strong>
                        {' '}of{' '}
                        <strong className="text-gray-800 font-semibold">{chatTotal}</strong> sessions
                      </p>

                      {chatTotal > CHAT_PAGE_LIMIT && (() => {
                        const totalPages = Math.ceil(chatTotal / CHAT_PAGE_LIMIT);
                        const getPageNums = () => {
                          if (totalPages <= 5) return Array.from({ length: totalPages }, (_, i) => i + 1);
                          if (chatPage <= 3) return [1, 2, 3, '…', totalPages];
                          if (chatPage >= totalPages - 2) return [1, '…', totalPages - 2, totalPages - 1, totalPages];
                          return [1, '…', chatPage - 1, chatPage, chatPage + 1, '…', totalPages];
                        };
                        return (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => fetchChatSessions(chatPage - 1)}
                              disabled={chatPage === 1}
                              className="p-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-white hover:text-indigo-600 transition disabled:opacity-40"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            {getPageNums().map((p, idx) =>
                              p === '…' ? (
                                <span key={`ellipsis-${idx}`} className="px-2 text-gray-400 text-sm">…</span>
                              ) : (
                                <button
                                  key={p}
                                  onClick={() => fetchChatSessions(p)}
                                  className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                                    chatPage === p
                                      ? 'bg-indigo-600 text-white shadow-sm'
                                      : 'border border-gray-300 text-gray-600 hover:bg-white hover:text-indigo-600'
                                  }`}
                                >
                                  {p}
                                </button>
                              )
                            )}
                            <button
                              onClick={() => fetchChatSessions(chatPage + 1)}
                              disabled={chatPage >= Math.ceil(chatTotal / CHAT_PAGE_LIMIT)}
                              className="p-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-white hover:text-indigo-600 transition disabled:opacity-40"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
};

export default DocumentManagement;
