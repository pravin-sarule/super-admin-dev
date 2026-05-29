import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  Copy,
  Database,
  Download,
  Eye,
  Gauge,
  Headphones,
  Languages,
  ListChecks,
  Loader2,
  Maximize2,
  MessageSquare,
  Minus,
  PhoneOff,
  Repeat2,
  Smile,
  Sparkles,
  X,
} from 'lucide-react';
import {
  formatCurrency,
  formatDateTime,
  formatDuration,
  formatLatency,
  maskPhone,
  shortCallId,
  titleize,
} from './voiceCallUtils';
import { getVoiceCallRecordingUrl } from '../api/jurinexVoiceApi';

const tabs = ['Transcription', 'Data', 'Detail Logs', 'Packet Capture'];

const StatRow = ({ Icon, label, value, tone = 'slate' }) => {
  const toneClass =
    tone === 'green'
      ? 'text-emerald-600'
      : tone === 'red'
        ? 'text-rose-600'
        : tone === 'blue'
          ? 'text-blue-600'
          : 'text-slate-500';
  return (
    <div className="grid grid-cols-[220px_1fr] items-center gap-4 py-1.5 text-sm">
      <div className="flex items-center gap-2 text-slate-700">
        <Icon className="w-4 h-4 text-slate-500" />
        <span>{label}</span>
      </div>
      <div className={`font-medium ${toneClass}`}>{value}</div>
    </div>
  );
};

const groupMessages = (messages = []) =>
  messages.reduce((acc, message) => {
    const text = String(message.text || '').trim();
    if (!text) return acc;
    const last = acc[acc.length - 1];
    if (last && last.speaker === message.speaker) {
      last.text = `${last.text}${text.startsWith('.') || text.startsWith(',') ? '' : ' '}${text}`.trim();
      last.ended_at = message.timestamp;
      return acc;
    }
    acc.push({
      id: message.id,
      speaker: message.speaker,
      language: message.language,
      text,
      started_at: message.timestamp,
      ended_at: message.timestamp,
    });
    return acc;
  }, []);

const JsonBlock = ({ value }) => (
  <pre className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-3 overflow-auto max-h-[420px]">
    {JSON.stringify(value || {}, null, 2)}
  </pre>
);

const VoiceCallDetailDrawer = ({ open, loading, detail, onClose }) => {
  const [showPii, setShowPii] = useState(false);
  const [activeTab, setActiveTab] = useState('Transcription');
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [recordingError, setRecordingError] = useState(null);
  const [recordingMissingDetails, setRecordingMissingDetails] = useState(null);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const call = detail?.call;
  const transcript = useMemo(() => groupMessages(detail?.messages || []), [detail]);

  if (!open) return null;

  const recordingUri = call?.recording_uri;
  const canPlayRecording = recordingUri && /^https?:\/\//i.test(recordingUri);

  // The DB usually stores recordings as gs://bucket/path which the
  // browser can't fetch directly. We POST to the admin API which
  // mints a short-lived v4 signed URL, then trigger the browser
  // download via a hidden <a download>. Direct https URLs (from
  // raw_metadata) get used as-is.
  const handleDownloadRecording = async () => {
    if (!call?.id || recordingBusy) return;
    setRecordingBusy(true);
    setRecordingError(null);
    setRecordingMissingDetails(null);
    try {
      const result = await getVoiceCallRecordingUrl(call.id);
      if (!result?.url) {
        throw new Error('Server did not return a recording URL.');
      }
      const a = document.createElement('a');
      a.href = result.url;
      if (result.filename) a.download = result.filename;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      // The backend returns a structured 404 when the object isn't in
      // GCS — show the looked-up path so the admin can hand it to the
      // runtime team instead of a generic "failed" message.
      if (err?.data?.error?.code === 'RECORDING_OBJECT_MISSING') {
        setRecordingMissingDetails({
          bucket: err.data.bucket,
          object: err.data.object,
          gcsUri: err.data.gcs_uri,
        });
        setRecordingError(err.data.error.message);
      } else {
        setRecordingError(err.message || 'Failed to fetch recording URL.');
      }
    } finally {
      setRecordingBusy(false);
    }
  };
  const outcomeTone = call?.session_outcome === 'successful' ? 'green' : call?.session_outcome === 'unsuccessful' ? 'red' : 'blue';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/20">
      <aside className="w-full max-w-[584px] h-full bg-white border-l border-slate-200 shadow-2xl flex flex-col">
        <header className="border-b border-slate-200">
          <div className="flex items-center justify-between px-4 py-2 text-xs text-slate-500 border-b border-slate-100">
            <span>Call details</span>
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-slate-100" aria-label="Close call detail">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-4 py-4">
            {loading && <div className="text-sm text-slate-400">Loading call...</div>}
            {!loading && call && (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-slate-950 truncate">
                      {formatDateTime(call.started_at).replace(' IST', '')} {call.channel_type}
                    </h2>
                    <div className="mt-1 text-xs text-slate-500 space-y-1">
                      <p className="truncate">
                        Agent: {call.agent_name || 'Jurinex Voice'}
                        {call.agent_id ? ` (${String(call.agent_id).slice(0, 8)}...)` : ''}
                        {call.agent_version ? ` · Version: ${call.agent_version}` : ''}
                      </p>
                      <p className="truncate">
                        Call ID: {shortCallId(call.id)}
                        <button
                          onClick={() => navigator.clipboard?.writeText(call.id)}
                          className="ml-1 align-middle text-slate-400 hover:text-slate-700"
                          aria-label="Copy call ID"
                        >
                          <Copy className="w-3.5 h-3.5 inline" />
                        </button>
                      </p>
                      <p>
                        Phone Call: {maskPhone(call.twilio_from || call.customer_phone, showPii)} →{' '}
                        {maskPhone(call.twilio_to, showPii)} ({titleize(call.direction)})
                      </p>
                      <p>
                        Duration: {formatDateTime(call.started_at)} - {formatDateTime(call.ended_at)} (
                        {formatDuration(call.duration_seconds)})
                      </p>
                      <p>
                        Cost: {formatCurrency(call.cost_usd)}
                        {call.llm_token_count ? ` · LLM Token: ${call.llm_token_count}` : ''}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPii((value) => !value)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="w-4 h-4" />
                    {showPii ? 'Hide PII' : 'Show PII'}
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  {canPlayRecording ? (
                    <audio src={recordingUri} controls className="h-10 flex-1" />
                  ) : (
                    <div className="h-10 flex-1 rounded-full bg-slate-100 text-xs text-slate-500 flex items-center px-4">
                      {recordingUri ? 'Recording stored in GCS' : 'No recording on file'}
                    </div>
                  )}
                  {recordingUri && (
                    <button
                      type="button"
                      onClick={handleDownloadRecording}
                      disabled={recordingBusy}
                      className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      aria-label="Download recording"
                      title={
                        canPlayRecording
                          ? 'Download recording'
                          : 'Download recording (signed URL, valid for 15 minutes)'
                      }
                    >
                      {recordingBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
                {recordingError && (
                  <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <div>{recordingError}</div>
                    {recordingMissingDetails && (
                      <div className="mt-1.5 space-y-0.5 font-mono text-[11px] text-red-800">
                        <div>
                          <span className="text-red-500">bucket: </span>
                          {recordingMissingDetails.bucket}
                        </div>
                        <div className="break-all">
                          <span className="text-red-500">object: </span>
                          {recordingMissingDetails.object}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard?.writeText(
                              recordingMissingDetails.gcsUri || ''
                            )
                          }
                          className="mt-1 inline-flex items-center gap-1 rounded border border-red-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-100"
                        >
                          <Copy className="h-3 w-3" />
                          Copy gs:// URI
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </header>

        {!loading && call && (
          <div className="flex-1 overflow-y-auto">
            <section className="px-4 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-950 mb-3">Conversation Analysis</h3>
              <div className="space-y-1">
                <StatRow
                  Icon={CheckSquare}
                  label="Call Successful"
                  value={titleize(call.session_outcome)}
                  tone={outcomeTone}
                />
                <StatRow Icon={Headphones} label="Call Status" value={titleize(call.status)} />
                <StatRow Icon={Smile} label="User Sentiment" value={titleize(call.user_sentiment)} tone="blue" />
                <StatRow Icon={PhoneOff} label="Disconnection Reason" value={titleize(call.end_reason)} />
                <StatRow Icon={Gauge} label="End to End Latency" value={formatLatency(call.end_to_end_latency_ms)} />
                <StatRow Icon={Languages} label="preferred_language" value={call.preferred_language || '—'} />
                <StatRow
                  Icon={Repeat2}
                  label="Turns"
                  value={
                    call.turn_count > 0
                      ? `${call.turn_count} turn${call.turn_count === 1 ? '' : 's'}`
                      : '—'
                  }
                />
              </div>
            </section>

            <section className="px-4 py-4 border-b border-slate-200">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-950">
                  Summary
                  {call.has_llm_summary ? (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700"
                      title={
                        call.extraction_model
                          ? `Generated by ${call.extraction_model}`
                          : 'Generated by the post-call extractor'
                      }
                    >
                      <Sparkles className="h-3 w-3" /> LLM
                    </span>
                  ) : call.summary ? (
                    <span
                      className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600"
                      title="Legacy heuristic from upstream (Customer reported / Agent closed with / Total turns). Enable post-call extraction to get a proper LLM summary."
                    >
                      legacy
                    </span>
                  ) : null}
                </h3>
                {call.summary && (
                  <button
                    type="button"
                    onClick={() => setSummaryModalOpen(true)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                    title="Expand summary"
                  >
                    <Maximize2 className="h-3 w-3" />
                    Expand
                  </button>
                )}
              </div>
              {call.summary ? (
                <p
                  className="line-clamp-5 cursor-pointer text-sm leading-6 text-slate-700 whitespace-pre-wrap hover:text-slate-900"
                  onClick={() => setSummaryModalOpen(true)}
                  title="Click to expand"
                >
                  {call.summary}
                </p>
              ) : (
                <p className="text-sm text-slate-400">—</p>
              )}
            </section>

            <nav className="sticky top-0 bg-white border-b border-slate-200 px-4 flex gap-6">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`py-3 text-sm border-b-2 ${
                    activeTab === tab
                      ? 'border-blue-600 text-slate-950 font-medium'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </nav>

            <div className="px-4 py-4">
              {activeTab === 'Transcription' && (
                <div className="space-y-3">
                  {transcript.length === 0 && (
                    <div className="text-sm text-slate-400">No transcript messages.</div>
                  )}
                  {transcript.map((message) => (
                    <div key={message.id} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-3 text-xs text-slate-500 mb-2">
                        <span className="font-semibold text-slate-700">{titleize(message.speaker)}</span>
                        <span>{formatDateTime(message.started_at)}</span>
                      </div>
                      <p className="text-sm leading-6 text-slate-800">{message.text}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'Data' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <Database className="w-4 h-4 text-slate-500" />
                    Call Data
                  </div>
                  <JsonBlock value={call} />
                </div>
              )}

              {activeTab === 'Detail Logs' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <ListChecks className="w-4 h-4 text-slate-500" />
                    Events
                  </div>
                  {(detail?.debug_events || []).map((event) => (
                    <div key={event.id} className="border border-slate-200 rounded-lg p-3">
                      <div className="flex items-center justify-between gap-3 text-xs text-slate-500 mb-1">
                        <span>{event.event_type} · {event.event_stage}</span>
                        <span>{formatDateTime(event.created_at)}</span>
                      </div>
                      <p className="text-sm text-slate-800">{event.message}</p>
                    </div>
                  ))}
                  {(detail?.debug_events || []).length === 0 && (
                    <div className="text-sm text-slate-400">No detail logs.</div>
                  )}
                </div>
              )}

              {activeTab === 'Packet Capture' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
                    <Database className="w-4 h-4 text-slate-500" />
                    Raw Metadata
                  </div>
                  <JsonBlock
                    value={{
                      raw_metadata: call.raw_metadata,
                      tool_events: detail?.tool_events || [],
                      tickets: detail?.tickets || [],
                      escalations: detail?.escalations || [],
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </aside>

      {summaryModalOpen && call && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 px-4"
          onClick={() => setSummaryModalOpen(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-900">
                  Call Summary — {formatDateTime(call.started_at).replace(' IST', '')} (
                  {formatDuration(call.duration_seconds)})
                </h3>
                {call.has_llm_summary ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700"
                    title={
                      call.extraction_model
                        ? `Generated by ${call.extraction_model}`
                        : 'Generated by the post-call extractor'
                    }
                  >
                    <Sparkles className="h-3 w-3" /> LLM
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                    legacy
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSummaryModalOpen(false)}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                  aria-label="Minimize"
                  title="Minimize back to drawer"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryModalOpen(false)}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                  aria-label="Close"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto px-5 py-4">
              <p className="text-sm leading-7 text-slate-800 whitespace-pre-wrap">
                {call.summary}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-slate-500">Sentiment</div>
                  <div className="font-semibold text-slate-800">
                    {titleize(call.user_sentiment) || '—'}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-slate-500">Outcome</div>
                  <div className="font-semibold text-slate-800">
                    {titleize(call.session_outcome) || '—'}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-slate-500">Turns</div>
                  <div className="font-semibold text-slate-800">
                    {call.turn_count > 0 ? call.turn_count : '—'}
                  </div>
                </div>
              </div>
              {!call.has_llm_summary && call.summary && (
                <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
                  This is the legacy heuristic summary from the upstream call agent. Enable post-call
                  extraction on the agent so future calls get a proper LLM-generated summary.
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
              <span className="text-[11px] text-slate-400">
                {call.extraction_model
                  ? `Model: ${call.extraction_model}`
                  : 'Click outside to close'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(call.summary || '');
                      setSummaryCopied(true);
                      setTimeout(() => setSummaryCopied(false), 1500);
                    } catch {
                      /* clipboard blocked */
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {summaryCopied ? 'Copied' : 'Copy summary'}
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryModalOpen(false)}
                  className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceCallDetailDrawer;
