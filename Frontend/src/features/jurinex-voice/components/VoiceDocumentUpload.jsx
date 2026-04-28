import React, { useEffect, useRef, useState } from 'react';
import { CloudUpload, FileText, CheckCircle, AlertCircle, Clock, Loader2 } from 'lucide-react';
import {
  listVoiceAgents,
  uploadVoiceDocument,
  getVoiceDocument,
} from '../api/jurinexVoiceApi';

const LANGUAGE_OPTIONS = [
  { value: '', label: 'Auto / Unknown' },
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'mr', label: 'Marathi' },
];

const STATUS_META = {
  processing: { label: 'Processing…', cls: 'bg-blue-100 text-blue-700 border-blue-200', Icon: Clock },
  ready: { label: 'Ready', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', Icon: CheckCircle },
  failed: { label: 'Failed', cls: 'bg-red-100 text-red-700 border-red-200', Icon: AlertCircle },
};

const VoiceDocumentUpload = ({ onUploaded }) => {
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState('');
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const pollRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    listVoiceAgents()
      .then((d) => setAgents((d.agents || []).filter((a) => a.status === 'active')))
      .catch(() => {});
    return () => pollRef.current && clearInterval(pollRef.current);
  }, []);

  const startPolling = (documentId) => {
    pollRef.current && clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await getVoiceDocument(documentId);
        const doc = data.document;
        setResult((prev) => ({ ...prev, ...doc }));
        if (doc.status === 'ready' || doc.status === 'failed') {
          clearInterval(pollRef.current);
          pollRef.current = null;
          onUploaded?.(doc);
        }
      } catch {
        /* keep polling */
      }
    }, 3000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please choose a file.');
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await uploadVoiceDocument({
        file,
        agent_id: agentId || undefined,
        title: title || undefined,
        language: language || undefined,
        tags: tags || undefined,
      });
      setResult({
        document_id: data.document_id,
        status: data.status,
        gcs_uri: data.gcs_uri,
        title: data.title,
      });
      if (data.document_id) startPolling(data.document_id);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const meta = result?.status ? STATUS_META[result.status] : null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
        <CloudUpload className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold text-slate-900">Upload knowledge document</h3>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Voice agent</label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              <option value="">Global (no specific agent)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.display_name || a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Title (optional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Defaults to filename"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Language</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Tags (comma separated)</label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="faq, support, billing"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Document file (PDF, DOCX, TXT, MD)</label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,.md"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white file:cursor-pointer hover:file:bg-blue-700"
          />
          {file && (
            <p className="mt-2 text-xs text-slate-500">
              <FileText className="inline w-3 h-3 mr-1" />
              {file.name} — {(file.size / 1024).toFixed(1)} KB
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={busy || !file}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
            {busy ? 'Uploading…' : 'Upload & process'}
          </button>
        </div>
      </form>

      {result && meta && (
        <div className="mx-6 mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.cls}`}>
              <meta.Icon className="w-3 h-3" /> {meta.label}
            </span>
            {result.chunk_count ? (
              <span className="text-xs text-slate-500">{result.chunk_count} chunks</span>
            ) : null}
          </div>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 text-xs">
            <div><dt className="text-slate-500">Document ID</dt><dd className="font-mono break-all">{result.document_id}</dd></div>
            <div><dt className="text-slate-500">Title</dt><dd>{result.title || '—'}</dd></div>
            <div className="md:col-span-2"><dt className="text-slate-500">GCS URI</dt><dd className="font-mono break-all">{result.gcs_uri || '—'}</dd></div>
            {result.error_message && (
              <div className="md:col-span-2"><dt className="text-slate-500">Error</dt><dd className="text-red-700">{result.error_message}</dd></div>
            )}
          </dl>
        </div>
      )}
    </div>
  );
};

export default VoiceDocumentUpload;
