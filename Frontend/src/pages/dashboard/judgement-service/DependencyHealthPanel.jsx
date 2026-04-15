import React from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';

function statusClasses(status) {
  if (status === 'healthy') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  if (status === 'unknown') {
    return 'border-slate-200 bg-slate-50 text-slate-700';
  }

  return 'border-rose-200 bg-rose-50 text-rose-700';
}

const DependencyHealthPanel = ({
  dependencyHealth,
  dependencyHealthLoading,
  onRefresh,
}) => {
  const dependencies = dependencyHealth?.dependencies || [];
  const unhealthyDependencies = dependencies.filter((dependency) => dependency.status !== 'healthy');
  const overallStatus = dependencyHealth?.overallStatus || 'unknown';
  const isHealthy = overallStatus === 'healthy';

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Dependency Monitor</h2>
          <p className="text-sm text-slate-500">
            Live status for PostgreSQL, object storage, Elasticsearch, Qdrant, and Document AI.
          </p>
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={dependencyHealthLoading}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${dependencyHealthLoading ? 'animate-spin' : ''}`} />
          Refresh Health
        </button>
      </div>

      <div className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${statusClasses(overallStatus)}`}>
        <div className="flex items-start gap-3">
          {overallStatus === 'healthy' ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5" />
          ) : overallStatus === 'unknown' ? (
            <RefreshCw className={`mt-0.5 h-5 w-5 ${dependencyHealthLoading ? 'animate-spin' : ''}`} />
          ) : (
            <AlertTriangle className="mt-0.5 h-5 w-5" />
          )}
          <div>
            <div className="font-semibold">
              {overallStatus === 'unknown'
                ? 'Checking judgment dependencies...'
                : isHealthy
                ? 'All judgment dependencies are healthy.'
                : `${unhealthyDependencies.length} dependency issue${unhealthyDependencies.length === 1 ? '' : 's'} detected.`}
            </div>
            <div className="mt-1">
              {overallStatus === 'unknown'
                ? 'The dashboard is verifying backend dependencies now.'
                : isHealthy
                ? 'Uploads and indexing dependencies are reachable.'
                : unhealthyDependencies.map((dependency) => `${dependency.label}: ${dependency.message}`).join(' | ')}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-4">Dependency</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Message</th>
                <th className="px-5 py-4">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-700">
              {dependencies.map((dependency) => (
                <tr key={dependency.key}>
                  <td className="px-5 py-4 font-medium text-slate-900">{dependency.label}</td>
                  <td className="px-5 py-4">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses(dependency.status)}`}>
                      {dependency.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">{dependency.message}</td>
                  <td className="px-5 py-4 text-slate-500">
                    {dependency.latencyMs != null ? `${dependency.latencyMs} ms` : 'N/A'}
                  </td>
                </tr>
              ))}
              {!dependencies.length && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-slate-500">
                    {dependencyHealthLoading ? 'Checking dependency health...' : 'No dependency health data yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};

export default DependencyHealthPanel;
