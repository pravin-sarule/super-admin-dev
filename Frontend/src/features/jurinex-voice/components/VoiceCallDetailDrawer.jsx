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
  PhoneOff,
  Smile,
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
  const call = detail?.call;
  const transcript = useMemo(() => groupMessages(detail?.messages || []), [detail]);

  if (!open) return null;

  const recordingUri = call?.recording_uri;
  const canPlayRecording = recordingUri && /^https?:\/\//i.test(recordingUri);
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
                      Recording stored in GCS
                    </div>
                  )}
                  {recordingUri && (
                    <a
                      href={recordingUri}
                      className="w-10 h-10 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                      aria-label="Open recording"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
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
              </div>
            </section>

            <section className="px-4 py-4 border-b border-slate-200">
              <h3 className="text-sm font-semibold text-slate-950 mb-2">Summary</h3>
              <p className="text-sm leading-6 text-slate-700 whitespace-pre-wrap">
                {call.summary || '—'}
              </p>
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
    </div>
  );
};

export default VoiceCallDetailDrawer;
