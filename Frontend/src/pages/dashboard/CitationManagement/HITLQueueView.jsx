import React, { useState, useEffect } from 'react';
import { MessageCircle, Hourglass, Check, X, Globe, AlertTriangle, ArrowUp } from 'lucide-react';
import { getHitlList, getHitlTask, postHitlAction } from '../../../services/citationAdminApi';
import { getToken } from '../../../config';

function priorityFromScore(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

const priorityStyles = {
  high: { dot: 'bg-red-500', text: 'text-red-600' },
  medium: { dot: 'bg-amber-500', text: 'text-amber-600' },
  low: { dot: 'bg-gray-400', text: 'text-gray-500' },
};

export default function HITLQueueView() {
  const [tasks, setTasks] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 0 });
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getHitlList({ status: 'PENDING', page: 1, pageSize: 50, sort: 'priority_desc' })
      .then((res) => {
        if (res?.success && res?.data) {
          setTasks(res.data.tasks || []);
          setPagination(res.data.pagination || { total: 0, totalPages: 0 });
          if (res.data.tasks?.length && !selected) setSelected(res.data.tasks[0]);
        }
      })
      .catch((err) => setError(err.response?.data?.error?.message || err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected?.task_id) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    getHitlTask(selected.task_id)
      .then((res) => res?.success && res?.data && setDetail(res.data))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [selected?.task_id]);

  const handleAction = (action, blacklist = false) => {
    if (!selected?.task_id || actionLoading) return;
    const reviewer = getToken() ? 'admin' : 'admin';
    setActionLoading(true);
    postHitlAction(selected.task_id, {
      action,
      reviewer,
      notes: '',
      blacklist: action === 'REJECTED' ? blacklist : false,
      reason: action === 'REJECTED' ? 'Rejected by reviewer' : '',
    })
      .then(() => {
        setTasks((prev) => prev.filter((t) => t.task_id !== selected.task_id));
        setPagination((p) => ({ ...p, total: Math.max(0, (p.total || 0) - 1) }));
        const next = tasks.find((t) => t.task_id !== selected.task_id);
        setSelected(next || null);
        setDetail(null);
      })
      .catch((err) => setError(err.response?.data?.error?.message || err.message))
      .finally(() => setActionLoading(false));
  };

  const displayTask = detail || selected;
  const pendingCount = pagination.total ?? tasks.length;
  const approvedCount = 0;
  const rejectedCount = 0;

  return (
    <div className="min-h-full bg-gray-100/80 rounded-2xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white border border-gray-200 shadow-sm flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">HITL Review Queue</h1>
            <p className="text-sm text-gray-500 mt-1">The Gatekeeper — verify what automation couldn&apos;t</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span className="flex items-center gap-2 text-amber-600">
            <Hourglass className="w-4 h-4" />
            <span className="font-semibold">{pendingCount}</span>
          </span>
          <span className="flex items-center gap-2 text-green-600">
            <Check className="w-4 h-4" />
            <span className="font-semibold">{approvedCount}</span>
          </span>
          <span className="flex items-center gap-2 text-red-600">
            <X className="w-4 h-4" />
            <span className="font-semibold">{rejectedCount}</span>
          </span>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-slate-800">Queue</h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-gray-500 text-sm">Loading…</div>
            ) : tasks.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">No pending tasks</div>
            ) : (
              tasks.map((task) => {
                const isSelected = selected?.task_id === task.task_id;
                const priority = priorityFromScore(task.priority_score ?? 0);
                const style = priorityStyles[priority];
                const title = task.citation_string || task.canonical_id || task.task_id;
                const titleShort = title.length > 42 ? title.slice(0, 42) + '...' : title;
                return (
                  <button
                    key={task.task_id}
                    type="button"
                    onClick={() => setSelected(task)}
                    className={`w-full text-left px-5 py-4 transition-colors border-b border-gray-100 last:border-b-0 ${
                      isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-bold text-slate-800 text-sm line-clamp-1 flex-1 min-w-0">{titleShort}</p>
                      <span className="flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        {task.status || 'PENDING'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{task.query_context || '—'}</p>
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${style.dot}`} />
                      <span className={`text-xs font-medium ${style.text}`}>{priority}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            {!selected ? (
              <p className="text-gray-500 text-sm">Select a task from the queue</p>
            ) : detailLoading ? (
              <p className="text-gray-500 text-sm">Loading detail…</p>
            ) : displayTask ? (
              <>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  REVIEW {displayTask.task_id?.slice(0, 8) || '—'}
                </p>
                <h2 className="text-lg font-bold text-slate-800 mb-6">
                  {displayTask.citation_string || displayTask.canonical_id || '—'}
                </h2>

                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">AI CLAIM</p>
                  <p className="text-sm text-slate-800">{displayTask.query_context || '—'}</p>
                </div>

                <div className="mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">FLAG REASON</p>
                  <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-100 rounded-xl">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700 font-medium">
                      Citation pending verification. Confirm or reject to update vault.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">PRIORITY SCORE</p>
                    <p className="text-2xl font-bold text-red-600">{displayTask.priority_score ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">SOURCE</p>
                    <p className="flex items-center gap-2 text-base font-bold text-blue-600">
                      <Globe className="w-4 h-4 flex-shrink-0" />
                      {displayTask.web_source_url ? (
                        <a href={displayTask.web_source_url} target="_blank" rel="noopener noreferrer" className="truncate max-w-[200px] hover:underline">
                          {displayTask.web_source_url}
                        </a>
                      ) : '—'}
                    </p>
                  </div>
                </div>

                {(displayTask.reason_queued || displayTask.report_id || displayTask.run_id || displayTask.case_id || displayTask.user_id) && (
                  <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">TASK METADATA</p>
                    {displayTask.reason_queued && <p className="text-sm text-slate-700"><span className="font-medium text-gray-600">Reason queued:</span> {displayTask.reason_queued}</p>}
                    {displayTask.report_id && <p className="text-sm text-slate-700"><span className="font-medium text-gray-600">Report ID:</span> {displayTask.report_id}</p>}
                    {displayTask.run_id && <p className="text-sm text-slate-700"><span className="font-medium text-gray-600">Run ID:</span> {displayTask.run_id}</p>}
                    {displayTask.case_id && <p className="text-sm text-slate-700"><span className="font-medium text-gray-600">Case ID:</span> {displayTask.case_id}</p>}
                    {displayTask.user_id && <p className="text-sm text-slate-700"><span className="font-medium text-gray-600">User ID:</span> {displayTask.user_id}</p>}
                    {displayTask.created_at && <p className="text-sm text-slate-700"><span className="font-medium text-gray-600">Created:</span> {new Date(displayTask.created_at).toLocaleString()}</p>}
                    {displayTask.reviewed_at && <p className="text-sm text-slate-700"><span className="font-medium text-gray-600">Reviewed at:</span> {new Date(displayTask.reviewed_at).toLocaleString()}</p>}
                    {displayTask.reviewed_by && <p className="text-sm text-slate-700"><span className="font-medium text-gray-600">Reviewed by:</span> {displayTask.reviewed_by}</p>}
                    {displayTask.updated_at && <p className="text-sm text-slate-700"><span className="font-medium text-gray-600">Updated:</span> {new Date(displayTask.updated_at).toLocaleString()}</p>}
                  </div>
                )}

                {displayTask.citation_snapshot && (() => {
                  let snap = displayTask.citation_snapshot;
                  if (typeof snap === 'string') {
                    try { snap = JSON.parse(snap); } catch { return null; }
                  }
                  if (typeof snap !== 'object' || snap === null) return null;
                  const row = (label, value) => value != null && value !== '' ? (
                    <div key={label} className="flex gap-2 py-1.5 border-b border-slate-100 last:border-0">
                      <span className="text-gray-500 font-medium shrink-0 w-36">{label}</span>
                      <span className="text-slate-800 text-sm">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                    </div>
                  ) : null;
                  return (
                    <div className="mb-5 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">CITATION SNAPSHOT</p>
                      <div className="space-y-0 text-sm">
                        {row('Case name', snap.caseName)}
                        {row('Primary citation', snap.primaryCitation)}
                        {row('Alternate citations', Array.isArray(snap.alternateCitations) ? snap.alternateCitations.join(', ') : snap.alternateCitations)}
                        {row('Court', snap.court)}
                        {row('Bench', snap.benchType)}
                        {row('Coram', snap.coram)}
                        {row('Date of judgment', snap.dateOfJudgment)}
                        {row('Ratio', snap.ratio)}
                        {snap.excerpt && (row('Excerpt', snap.excerpt.para && snap.excerpt.text ? `${snap.excerpt.para}: ${snap.excerpt.text}` : JSON.stringify(snap.excerpt)))}
                        {Array.isArray(snap.statutes) && snap.statutes.length > 0 && row('Statutes', snap.statutes.join('; '))}
                        {row('Source', snap.sourceLabel || snap.source)}
                        {row('Query context', snap.queryContext)}
                        {row('Confidence', snap.confidence != null ? `${snap.confidence}%` : null)}
                        {row('Priority score', snap.priorityScore)}
                        {row('Verification', snap.verificationStatusLabel || snap.verificationStatus)}
                        {row('Canonical ID', snap.canonicalId)}
                        {row('ID', snap.id)}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleAction('APPROVED')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{
                      backgroundColor: '#D4EDDA',
                      color: '#28A745',
                      borderColor: '#28A745',
                    }}
                  >
                    <Check className="w-4 h-4" style={{ color: '#28A745' }} />
                    <span>Approve</span>
                    <span className="opacity-80">— Vault</span>
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleAction('REJECTED', true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{
                      backgroundColor: '#F8D7DA',
                      color: '#DC3545',
                      borderColor: '#DC3545',
                    }}
                  >
                    <X className="w-4 h-4" style={{ color: '#DC3545' }} />
                    <span>Reject</span>
                    <span className="opacity-80">— Blacklist</span>
                  </button>
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleAction('ESCALATED')}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border transition-opacity hover:opacity-90 disabled:opacity-50"
                    style={{
                      backgroundColor: '#D1ECF1',
                      color: '#17A2B8',
                      borderColor: '#17A2B8',
                    }}
                  >
                    <ArrowUp className="w-4 h-4" style={{ color: '#17A2B8' }} />
                    Escalate
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
