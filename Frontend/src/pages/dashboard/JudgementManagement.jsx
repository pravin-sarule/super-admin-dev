import React from 'react';
import { Database, FileUp } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import JudgementPipelineReportDashboard from './judgement-pipeline-report';
import JudgementServiceDashboard from './judgement-service';

const DASHBOARD_VIEWS = {
  admin_upload: {
    label: 'Admin Uploads',
    description: 'Upload PDFs, monitor OCR, inspect metadata, and manage the admin ingestion pipeline.',
    icon: FileUp,
  },
  ik_pipeline: {
    label: 'User Pipeline',
    description: 'Track judgments inserted after user citation searches fall back to Indian Kanoon.',
    icon: Database,
  },
};

function normalizeView(view) {
  if (view === 'ik_pipeline') {
    return 'ik_pipeline';
  }

  return 'admin_upload';
}

const JudgementManagement = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeView = normalizeView(searchParams.get('view'));

  function handleViewChange(nextView) {
    const normalizedView = normalizeView(nextView);
    const nextSearchParams = new URLSearchParams(searchParams);

    if (normalizedView === 'admin_upload') {
      nextSearchParams.delete('view');
    } else {
      nextSearchParams.set('view', normalizedView);
    }

    setSearchParams(nextSearchParams, { replace: true });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold text-slate-900">Judgment Dashboards</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Switch between the admin-upload workspace and the user citation fallback report without leaving the
              judgments section.
            </p>
          </div>

          <div className="inline-flex rounded-2xl border border-slate-200 bg-slate-100 p-1">
            {Object.entries(DASHBOARD_VIEWS).map(([key, view]) => {
              const Icon = view.icon;
              const isActive = key === activeView;

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleViewChange(key)}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {view.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-600">
          {DASHBOARD_VIEWS[activeView].description}
        </div>
      </section>

      {activeView === 'ik_pipeline' ? (
        <JudgementPipelineReportDashboard sourceType="ik_pipeline" />
      ) : (
        <JudgementServiceDashboard />
      )}
    </div>
  );
};

export default JudgementManagement;
