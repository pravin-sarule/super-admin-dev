import React from 'react';
import { Database, FileUp } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import JudgementLibraryDashboard from './judgement-library';
import JudgementPipelineReportDashboard from './judgement-pipeline-report';

// Admin Uploads is the Elasticsearch-only flow: each PDF becomes an Indian
// Kanoon-format record in ik_judgments. The earlier OCR/Qdrant/Postgres pipeline
// (pages/dashboard/judgement-service) is no longer wired into this page.
const DASHBOARD_VIEWS = {
  ik_pipeline: {
    label: 'User Pipeline',
    description: 'Track judgments inserted after user citation searches fall back to Indian Kanoon.',
    icon: Database,
  },
  admin_upload: {
    label: 'Admin Uploads',
    description: 'Upload court PDFs straight into the judgment library as Indian Kanoon-format records (Elasticsearch only).',
    icon: FileUp,
  },
};

function normalizeView(view) {
  // "library_upload" was a short-lived alias for the same workspace.
  if (view === 'admin_upload' || view === 'library_upload') {
    return 'admin_upload';
  }

  return 'ik_pipeline';
}

const JudgementManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = normalizeView(searchParams.get('view'));

  function handleViewChange(nextView) {
    const normalizedView = normalizeView(nextView);
    const nextSearchParams = new URLSearchParams(searchParams);

    if (normalizedView === 'ik_pipeline') {
      nextSearchParams.delete('view');
    } else {
      nextSearchParams.set('view', normalizedView);
    }

    setSearchParams(nextSearchParams, { replace: true });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold text-slate-900">Judgment Dashboards</h1>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              {DASHBOARD_VIEWS[activeView].description}
            </p>
          </div>

          <div className="inline-flex self-start rounded-lg border border-slate-200 bg-slate-100 p-0.5 sm:self-auto">
            {Object.entries(DASHBOARD_VIEWS).map(([key, view]) => {
              const Icon = view.icon;
              const isActive = key === activeView;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleViewChange(key)}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {view.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {activeView === 'ik_pipeline' ? (
        <JudgementPipelineReportDashboard sourceType="ik_pipeline" />
      ) : (
        <JudgementLibraryDashboard />
      )}
    </div>
  );
};

export default JudgementManagement;
