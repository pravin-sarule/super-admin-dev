import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Eye, Trash2, FileText, ChevronLeft, ChevronRight, Search, Upload,
  AlertCircle, CheckCircle, Clock, RefreshCw, Cpu, CloudUpload, Zap,
  Bot, Mic, Save, Volume2, Sliders, MessageSquare, FileUp, X,
  ChevronDown, Filter, BarChart3, Database, Settings2, TrendingUp, Activity,
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

const isProcessing = (s) => ['ocr_processing', 'embedding_processing', 'uploaded'].includes(s);

const formatDate = (d) => d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const formatFileSize = (bytes) => {
  if (!bytes) return null;
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
};

// ─── Chatbot config constants ──────────────────────────────────────────────────

const GEMINI_TEXT_MODELS = [
  'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-1.5-pro',
  'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro',
];

// Official Gemini Live API model IDs (ai.google.dev/gemini-api/docs/models)
const GEMINI_LIVE_MODELS = [
  'gemini-3.1-flash-live-preview',
  'gemini-2.5-flash-native-audio-preview-12-2025',
];

// All 30 official Gemini Live API voices (ai.google.dev/gemini-api/docs/live)
// speaking_rate / pitch / volume / language_code are NOT supported by the Live API
const VOICE_OPTIONS = [
  // Upbeat
  { value: 'Puck',          style: 'Upbeat' },
  { value: 'Fenrir',        style: 'Upbeat' },
  { value: 'Laomedeia',     style: 'Upbeat' },
  // Bright
  { value: 'Zephyr',        style: 'Bright' },
  { value: 'Kore',          style: 'Bright' },
  { value: 'Orus',          style: 'Bright' },
  { value: 'Autonoe',       style: 'Bright' },
  // Clear
  { value: 'Charon',        style: 'Clear' },
  { value: 'Iapetus',       style: 'Clear' },
  { value: 'Erinome',       style: 'Clear' },
  { value: 'Alnilam',       style: 'Clear' },
  // Calm
  { value: 'Aoede',         style: 'Calm' },
  { value: 'Umbriel',       style: 'Calm' },
  { value: 'Callirrhoe',    style: 'Calm' },
  { value: 'Despina',       style: 'Calm' },
  { value: 'Algieba',       style: 'Calm' },
  { value: 'Achernar',      style: 'Calm' },
  // Distinct
  { value: 'Schedar',       style: 'Distinct' },
  { value: 'Achird',        style: 'Distinct' },
  { value: 'Sadachbia',     style: 'Distinct' },
  { value: 'Enceladus',     style: 'Distinct' },
  { value: 'Algenib',       style: 'Distinct' },
  { value: 'Gacrux',        style: 'Distinct' },
  { value: 'Zubenelgenubi', style: 'Distinct' },
  { value: 'Sadaltager',    style: 'Distinct' },
  { value: 'Leda',          style: 'Distinct' },
  { value: 'Rasalgethi',    style: 'Distinct' },
  { value: 'Pulcherrima',   style: 'Distinct' },
  { value: 'Vindemiatrix',  style: 'Distinct' },
  { value: 'Sulafat',       style: 'Distinct' },
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
  model_text: 'gemini-1.5-flash', max_tokens: 150, temperature: 0.1, top_p: 0.95, top_k_results: 5,
  model_audio: 'gemini-3.1-flash-live-preview', voice_name: 'Puck',
  system_prompt: "You are the Nexintel AI Support Agent. Provide fast, accurate solutions based ONLY on the provided document context. If the answer is not found, state: \"I'm sorry, I don't have information on that in our records.\" Keep responses under 3 sentences.",
  audio_system_prompt: "You are the Nexintel AI Support Agent. Provide fast, accurate answers based ONLY on documents retrieved via search_documents. Keep spoken responses under 20 seconds.",
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

const StatCard = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon className="w-5 h-5 text-white" />
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
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
  const [usageError, setUsageError]     = useState(null);

  // ─── AI Config state ─────────────────────────────────────────────────────────
  const [cfg, setCfg] = useState(CONFIG_DEFAULTS);
  const [cfgLoading, setCfgLoading] = useState(false);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgLoaded, setCfgLoaded] = useState(false);
  const [cfgToast, setCfgToast] = useState(null);
  const [voiceStyleFilter, setVoiceStyleFilter] = useState('All');
  const setCfgField = (key) => (val) => setCfg((f) => ({ ...f, [key]: val }));

  const showCfgToast = (type, msg) => {
    setCfgToast({ type, msg });
    setTimeout(() => setCfgToast(null), 3500);
  };

  // ─── Usage helpers ───────────────────────────────────────────────────────────
  const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN'));
  const fmtInr = (n) => (n == null ? '—' : `₹${Number(n).toFixed(4)}`);

  const USAGE_PERIOD_OPTS = [
    { value: 'daily',   label: 'Today' },
    { value: 'weekly',  label: '7 Days' },
    { value: 'monthly', label: '30 Days' },
    { value: 'yearly',  label: '365 Days' },
    { value: 'all',     label: 'All Time' },
  ];

  const USAGE_MODEL_OPTS = [
    { value: 'all', label: 'All Models' },
    ...GEMINI_TEXT_MODELS.map(m => ({ value: m, label: m })),
    ...GEMINI_LIVE_MODELS.map(m => ({ value: m, label: m })),
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
      if (json.success) setUsageData(json.data);
      else setUsageError(json.error || 'Failed to load usage data');
    } catch (err) {
      setUsageError(err.message || 'Failed to load usage data');
    } finally {
      setUsageLoading(false);
    }
  }, [usagePeriod, usageModel]);

  useEffect(() => {
    if (activeTab === 'usage') fetchUsage();
  }, [activeTab, fetchUsage]);

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
            // Only merge the 13 editable fields — ignore id, config_key, updated_at etc.
            const clean = {};
            for (const key of Object.keys(CONFIG_DEFAULTS)) {
              if (config[key] !== undefined) clean[key] = config[key];
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
          if (config[key] !== undefined) clean[key] = config[key];
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

  // ─── Tabs ─────────────────────────────────────────────────────────────────────

  const tabs = [
    { key: 'documents', label: 'Documents',        icon: Database  },
    { key: 'config',    label: 'AI Configuration', icon: Settings2 },
    { key: 'usage',     label: 'Usage Analytics',  icon: BarChart3 },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Page header ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Cpu className="w-6 h-6 text-indigo-600" />
              AI Document Processing
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Upload → OCR → Chunk → Embed → pgvector</p>
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
              onClick={() => { setActiveTab(key); setSelectedDoc(null); }}
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
              <StatCard label="Total Documents"   value={counts.all}        icon={FileText}    color="bg-indigo-500" />
              <StatCard label="Active & Indexed"  value={counts.active}     icon={CheckCircle} color="bg-emerald-500" />
              <StatCard label="Processing"        value={counts.processing}  icon={Clock}       color="bg-blue-500" />
              <StatCard label="Total Chunks"      value={counts.chunks}     icon={Database}    color="bg-purple-500" />
            </div>

            {/* Upload zone */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <CloudUpload className="w-4 h-4 text-indigo-500" />
                Upload Document
              </h2>

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
                  <>
                    <FileUp className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-600">Drop a PDF here, or click to browse</p>
                    <p className="text-xs text-gray-400 mt-1">Only PDF files are supported</p>
                  </>
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
              <div className="flex flex-wrap items-end gap-3 mt-4">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Document Type</label>
                  <SelectInput
                    value={uploadType}
                    options={DOCUMENT_TYPES}
                    onChange={setUploadType}
                  />
                </div>
                <button
                  onClick={handleUpload}
                  disabled={uploadLoading || !uploadFile}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadLoading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" />{stageLabel[uploadStage] || 'Working…'}</>
                  ) : (
                    <><Upload className="w-4 h-4" />Upload & Process</>
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-yellow-400" />
                File uploads directly to GCS via signed URL — no server buffering. OCR + embedding runs async.
              </p>
            </div>

            {/* Filter bar */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                {/* Status chips */}
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: 'all',          label: `All (${counts.all})` },
                    { key: 'active',       label: `Active (${counts.active})` },
                    { key: 'ocr_processing', label: `Processing (${counts.processing})` },
                    { key: 'failed',       label: `Failed (${counts.failed})` },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => { setStatusFilter(key); setCurrentPage(1); }}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
                        statusFilter === key
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Search + type filter + refresh */}
                <div className="flex gap-2 items-center flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                    <input
                      type="text"
                      placeholder="Search…"
                      value={searchValue}
                      onChange={(e) => { setSearchValue(e.target.value); setCurrentPage(1); }}
                      className="pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-48"
                    />
                  </div>
                  <div className="relative">
                    <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                    <select
                      value={typeFilter}
                      onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
                      className="pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 appearance-none bg-white"
                    >
                      <option value="all">All Types</option>
                      {DOCUMENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
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
                  <thead className="bg-gray-50">
                    <tr>
                      {['Document', 'Type', 'Status', 'Pages', 'Chunks', 'Uploaded', 'Actions'].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
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
                        <tr key={doc.id} className="hover:bg-gray-50 transition-colors group">
                          {/* Name */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                <FileText className="w-4 h-4 text-red-400" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900 truncate max-w-[200px]">{doc.originalname}</p>
                                <p className="text-xs text-gray-400 font-mono truncate max-w-[200px]">{doc.id}</p>
                              </div>
                            </div>
                          </td>
                          {/* Type */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <span className="text-xs font-medium px-2.5 py-1 bg-slate-100 text-slate-600 rounded-full capitalize">
                              {doc.document_type || 'general'}
                            </span>
                          </td>
                          {/* Status */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <StatusBadge status={doc.status} />
                            {isProcessing(doc.status) && (
                              <div className="mt-1.5 w-20 bg-gray-200 rounded-full h-1">
                                <div className="bg-indigo-500 h-1 rounded-full animate-pulse w-1/2" />
                              </div>
                            )}
                          </td>
                          {/* Pages */}
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600">
                            {doc.total_pages ?? '—'}
                          </td>
                          {/* Chunks */}
                          <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600">
                            {doc.chunks_count ?? '—'}
                          </td>
                          {/* Date */}
                          <td className="px-5 py-3.5 whitespace-nowrap text-xs text-gray-400">
                            {formatDate(doc.created_at)}
                          </td>
                          {/* Actions */}
                          <td className="px-5 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {doc.status === 'active' && (
                                <button
                                  onClick={() => setSelectedDoc(doc)}
                                  className="p-1.5 rounded-lg text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition border border-transparent hover:border-indigo-200"
                                  title="View details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(doc.id, doc.originalname)}
                                disabled={deleteLoading[doc.id]}
                                className="p-1.5 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition border border-transparent hover:border-red-200 disabled:opacity-40"
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
              {!docsLoading && filtered.length > itemsPerPage && (
                <div className="px-5 py-3 flex items-center justify-between border-t border-gray-100 bg-gray-50">
                  <p className="text-xs text-gray-500">
                    {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filtered.length)} of {filtered.length}
                  </p>
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
          <div className="space-y-4">

            {/* Loading overlay */}
            {cfgLoading && (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600" />
                  <p className="text-sm text-gray-400">Loading configuration…</p>
                </div>
              </div>
            )}

            {!cfgLoading && (
              <>
                {/* Toast */}
                {cfgToast && (
                  <div className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium border ${
                    cfgToast.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    {cfgToast.type === 'success'
                      ? <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                      : <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                    {cfgToast.msg}
                  </div>
                )}

                {/* ── Text Model ─────────────────────────────────────────── */}
                <Accordion icon={Cpu} iconColor="bg-blue-500" title="Text Model" defaultOpen badge={cfg.model_text}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4">
                    <div>
                      <FieldLabel hint="Used for text-based Q&A responses">Model</FieldLabel>
                      <SelectInput value={cfg.model_text} options={GEMINI_TEXT_MODELS} onChange={setCfgField('model_text')} />
                    </div>
                    <div>
                      <FieldLabel hint="Max tokens in a single response (50–2048)">Max Output Tokens</FieldLabel>
                      <input type="number" min={50} max={2048} step={50} value={cfg.max_tokens}
                        onChange={(e) => setCfgField('max_tokens')(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <RangeSlider label="Temperature" hint="Lower = more deterministic"
                      value={cfg.temperature} min={0} max={1} step={0.01}
                      format={(v) => v.toFixed(2)} onChange={setCfgField('temperature')} />
                    <RangeSlider label="Top-P" hint="Controls output diversity"
                      value={cfg.top_p} min={0} max={1} step={0.01}
                      format={(v) => v.toFixed(2)} onChange={setCfgField('top_p')} />
                    <div>
                      <FieldLabel hint="Number of chunks retrieved for RAG context">Top-K Results (RAG)</FieldLabel>
                      <input type="number" min={1} max={20} step={1} value={cfg.top_k_results}
                        onChange={(e) => setCfgField('top_k_results')(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                </Accordion>

                {/* ── Live Audio Model ───────────────────────────────────── */}
                <Accordion icon={Mic} iconColor="bg-purple-500" title="Live Audio Model" badge={cfg.model_audio}>
                  <div className="pt-4 max-w-sm">
                    <FieldLabel hint="Real-time voice conversation model">Live Model</FieldLabel>
                    <SelectInput value={cfg.model_audio} options={GEMINI_LIVE_MODELS} onChange={setCfgField('model_audio')} />
                    <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      The Gemini Live API does not expose speaking rate, pitch, volume, or language code as configurable parameters — the model handles these automatically.
                    </p>
                  </div>
                </Accordion>

                {/* ── Voice Picker — all 30 official voices ─────────────── */}
                <Accordion icon={Volume2} iconColor="bg-violet-500" title="Voice Selection" badge={cfg.voice_name}>
                  <div className="pt-4 space-y-3">
                    {/* Style filter chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {['All', 'Upbeat', 'Bright', 'Clear', 'Calm', 'Distinct'].map((s) => (
                        <button
                          key={s}
                          onClick={() => setVoiceStyleFilter(s)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                            voiceStyleFilter === s
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    {/* Voice grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2 max-h-64 overflow-y-auto pr-1">
                      {VOICE_OPTIONS
                        .filter((v) => voiceStyleFilter === 'All' || v.style === voiceStyleFilter)
                        .map(({ value, style }) => (
                          <button
                            key={value}
                            onClick={() => setCfgField('voice_name')(value)}
                            className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 transition-all ${
                              cfg.voice_name === value
                                ? 'border-indigo-500 bg-indigo-50'
                                : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                              cfg.voice_name === value ? 'bg-indigo-500' : 'bg-gray-100'
                            }`}>
                              <Mic className={`w-3.5 h-3.5 ${cfg.voice_name === value ? 'text-white' : 'text-gray-500'}`} />
                            </div>
                            <span className={`text-xs font-semibold leading-tight text-center ${
                              cfg.voice_name === value ? 'text-indigo-700' : 'text-gray-700'
                            }`}>{value}</span>
                            <VoiceStyleBadge style={style} />
                          </button>
                        ))}
                    </div>
                  </div>
                </Accordion>

                {/* ── System Prompts ─────────────────────────────────────── */}
                <Accordion icon={MessageSquare} iconColor="bg-emerald-500" title="System Prompts">
                  <div className="space-y-4 pt-4">
                    <div>
                      <FieldLabel hint="Injected before every text-model conversation">Text Chat System Prompt</FieldLabel>
                      <textarea rows={5} value={cfg.system_prompt}
                        onChange={(e) => setCfgField('system_prompt')(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 resize-y"
                      />
                    </div>
                    <div>
                      <FieldLabel hint="Injected before every live audio session — keep concise">Audio / Live Model System Prompt</FieldLabel>
                      <textarea rows={4} value={cfg.audio_system_prompt}
                        onChange={(e) => setCfgField('audio_system_prompt')(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 resize-y"
                      />
                    </div>
                  </div>
                </Accordion>

                {/* ── Summary card ───────────────────────────────────────── */}
                <Accordion icon={BarChart3} iconColor="bg-orange-500" title="Active Configuration Summary">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 pt-4">
                    {[
                      { label: 'Text Model',    value: cfg.model_text },
                      { label: 'Live Model',    value: cfg.model_audio },
                      { label: 'Voice',         value: cfg.voice_name },
                      { label: 'Temperature',   value: cfg.temperature?.toFixed(2) ?? '—' },
                      { label: 'Top-P',         value: cfg.top_p?.toFixed(2) ?? '—' },
                      { label: 'Max Tokens',    value: cfg.max_tokens },
                      { label: 'Top-K Results', value: cfg.top_k_results },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-white rounded-lg border border-gray-200 p-3">
                        <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
                        <p className="text-sm font-bold text-gray-900 truncate">{value}</p>
                      </div>
                    ))}
                  </div>
                </Accordion>

                {/* Save / Reset row */}
                <div className="flex justify-end gap-3 pb-2">
                  <button
                    onClick={() => { setCfg(CONFIG_DEFAULTS); showCfgToast('success', 'Reset to defaults (not saved yet).'); }}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" /> Reset Defaults
                  </button>
                  <button
                    onClick={handleSaveCfg}
                    disabled={cfgSaving}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition disabled:opacity-60 shadow-sm"
                  >
                    {cfgSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {cfgSaving ? 'Saving…' : 'Save Configuration'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════
            ── USAGE ANALYTICS TAB ───────────────────────────────────────────── */}
        {activeTab === 'usage' && (
          <div className="space-y-5">

            {/* Filters row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1 flex-wrap">
                {USAGE_PERIOD_OPTS.map(b => (
                  <button
                    key={b.value}
                    onClick={() => setUsagePeriod(b.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      usagePeriod === b.value
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <select
                    value={usageModel}
                    onChange={e => setUsageModel(e.target.value)}
                    className="pl-3 pr-8 py-1.5 border border-gray-300 rounded-lg text-xs font-medium bg-white focus:ring-2 focus:ring-indigo-500 appearance-none"
                  >
                    {USAGE_MODEL_OPTS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
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
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {usageError}
              </div>
            )}

            {/* Loading skeleton */}
            {usageLoading && !usageData && (
              <div className="flex items-center justify-center py-20">
                <div className="flex flex-col items-center gap-3">
                  <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-indigo-600" />
                  <p className="text-sm text-gray-400">Loading analytics…</p>
                </div>
              </div>
            )}

            {/* Data */}
            {usageData && (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Total Input Tokens',  value: fmtNum(usageData.totals?.total_input),    icon: TrendingUp, color: 'bg-blue-500'   },
                    { label: 'Total Output Tokens', value: fmtNum(usageData.totals?.total_output),   icon: Activity,   color: 'bg-purple-500' },
                    { label: 'Total Tokens',        value: fmtNum(usageData.totals?.total_all),      icon: Zap,        color: 'bg-indigo-500' },
                    { label: 'Total Cost (₹)',      value: fmtInr(usageData.totals?.total_cost_inr), icon: BarChart3,  color: 'bg-green-500'  },
                  ].map(({ label, value, icon: Icon, color }) => (
                    <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-gray-900">{value}</p>
                        <p className="text-xs text-gray-500 font-medium">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-gray-400">
                  {fmtNum(usageData.totals?.total_requests)} total requests · Pricing: ₹28.33/M input, ₹236/M output (text) · ₹282/M input, ₹1,129/M output (audio)
                </p>

                {/* Model breakdown table */}
                {usageData.model_breakdown?.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-3 border-b border-gray-100">
                      <h3 className="text-sm font-semibold text-gray-800">Model Breakdown</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            {['Model', 'Mode', 'Requests', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Cost (₹)'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {usageData.model_breakdown.map((row, i) => (
                            <tr key={`${row.model_name}-${row.mode}`} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                              <td className="px-4 py-3 text-xs font-medium text-gray-900 whitespace-nowrap">{row.model_name}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  row.mode === 'audio' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {row.mode}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-700">{fmtNum(row.request_count)}</td>
                              <td className="px-4 py-3 text-xs text-gray-700">{fmtNum(row.total_input)}</td>
                              <td className="px-4 py-3 text-xs text-gray-700">{fmtNum(row.total_output)}</td>
                              <td className="px-4 py-3 text-xs font-semibold text-gray-900">{fmtNum(row.total_all)}</td>
                              <td className="px-4 py-3 text-xs font-semibold text-green-600">{fmtInr(row.cost_inr)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t-2 border-gray-200 bg-indigo-50">
                          <tr>
                            <td colSpan={2} className="px-4 py-3 text-xs font-bold text-indigo-900">Grand Total</td>
                            <td className="px-4 py-3 text-xs font-bold text-indigo-900">{fmtNum(usageData.totals?.total_requests)}</td>
                            <td className="px-4 py-3 text-xs font-bold text-indigo-900">{fmtNum(usageData.totals?.total_input)}</td>
                            <td className="px-4 py-3 text-xs font-bold text-indigo-900">{fmtNum(usageData.totals?.total_output)}</td>
                            <td className="px-4 py-3 text-xs font-bold text-indigo-900">{fmtNum(usageData.totals?.total_all)}</td>
                            <td className="px-4 py-3 text-xs font-bold text-green-700">{fmtInr(usageData.totals?.total_cost_inr)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}

                {/* Recent logs table */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-800">Recent Logs</h3>
                    {usageData.logs?.length > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
                        {usageData.logs.length} entries
                      </span>
                    )}
                  </div>
                  {!usageData.logs?.length ? (
                    <div className="px-5 py-12 text-center">
                      <p className="text-sm text-gray-400">No records for the selected period / model.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0 z-10">
                          <tr>
                            {['#', 'Time', 'Mode', 'Model', 'Input', 'Output', 'Total', 'Cost (₹)', 'IP'].map(h => (
                              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {usageData.logs.map((row, i) => (
                            <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                              <td className="px-4 py-2.5 text-xs text-gray-400">{i + 1}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-600 whitespace-nowrap">
                                {new Date(row.created_at).toLocaleString('en-IN')}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                  row.mode === 'audio' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {row.mode}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-xs font-medium text-gray-900 whitespace-nowrap">{row.model_name}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-700">{fmtNum(row.input_tokens)}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-700">{fmtNum(row.output_tokens)}</td>
                              <td className="px-4 py-2.5 text-xs font-semibold text-gray-900">{fmtNum(row.total_tokens)}</td>
                              <td className="px-4 py-2.5 text-xs font-semibold text-green-600">{fmtInr(row.cost_inr)}</td>
                              <td className="px-4 py-2.5 text-xs text-gray-400">{row.ip_address || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
