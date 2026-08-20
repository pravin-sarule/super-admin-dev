import React from 'react';
import {
  ArrowLeft,
  LoaderCircle,
} from 'lucide-react';
import { STATUS_STYLES } from '../judgement-service/constants';
import { prettyStatus } from '../judgement-service/helpers';
import { formatDateTime } from './helpers';

const BACK_BUTTON_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-black';

const PipelineInspectDashboard = ({
  detail,
  detailError,
  detailLoading,
  judgmentUuid,
  onBack,
}) => {
  if (!judgmentUuid) {
    return null;
  }

  if (detailLoading && !detail) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className={BACK_BUTTON_CLASS}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-10 text-center text-xs text-slate-500">
          <LoaderCircle className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-600" />
          Loading pipeline judgment...
        </div>
      </section>
    );
  }

  if (detailError || !detail) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className={BACK_BUTTON_CLASS}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {detailError || 'Pipeline judgment not found'}
        </div>
      </section>
    );
  }

  const upload = detail.upload || {};
  const judgment = detail.judgment || {};
  const textPreview = String(detail.textPreview || upload.mergedText || '');
  const htmlDoc = String(detail.htmlDoc || upload.htmlDoc || '');
  const hasHtmlDoc = /<\/?[a-z][\s\S]*>/i.test(htmlDoc);
  const detailStatus = upload.status || judgment.status;
  const sourceUrl = upload.sourceUrl || judgment.citation_data?.source_url || '';
  const documentId = upload.canonicalId || judgment.canonical_id || judgmentUuid;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className={BACK_BUTTON_CLASS}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back
              </button>
              <span className="inline-flex rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                User Pipeline Inspect
              </span>
            </div>
            <h2 className="mt-2 truncate text-sm font-semibold text-slate-900">
              {upload.originalFilename || judgment.case_name || 'Pipeline judgment'}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
              <span className="font-medium text-slate-700">{documentId}</span>
              {detailStatus ? (
                <span
                  className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    STATUS_STYLES[detailStatus] || STATUS_STYLES.uploaded
                  }`}
                >
                  {prettyStatus(detailStatus)}
                </span>
              ) : null}
              {upload.createdAt ? (
                <span>Inserted {formatDateTime(upload.createdAt)}</span>
              ) : null}
            </div>
          </div>
        </div>

        {(detail.warnings || []).length ? (
          <div className="mt-3 truncate text-[11px] font-medium text-amber-700" title={(detail.warnings || []).map((warning) => `${warning.store}: ${warning.message}`).join('\n')}>
            {(detail.warnings || []).map((warning) => `${warning.store}: ${warning.message}`).join(' · ')}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Document Workspace</h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              Metadata captured from Indian Kanoon for {upload.originalFilename || judgment.case_name || 'this judgment'}.
            </p>
          </div>
          {detailStatus ? (
            <span
              className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                STATUS_STYLES[detailStatus] || STATUS_STYLES.uploaded
              }`}
            >
              {prettyStatus(detailStatus)}
            </span>
          ) : null}
        </div>

        <div className="grid gap-2 p-3 md:grid-cols-2">
          <MetadataField label="Case Name" value={judgment.case_name} />
          <MetadataField label="Court Code" value={judgment.court_code} />
          <MetadataField label="Judgment Date" value={formatJudgmentDate(judgment.judgment_date)} />
          <MetadataField label="Year" value={judgment.year} />
          <MetadataField
            label="Primary Citation"
            value={judgment.citation_data?.primary_citation || upload.metadata?.primaryCitation}
            className="md:col-span-2"
          />
          <MetadataField
            label="Alternate Citations"
            value={
              (judgment.citation_data?.alternate_citations
                || upload.metadata?.alternateCitations
                || []).join(', ')
            }
            className="md:col-span-2"
          />
          <MetadataField
            label="Source URL"
            value={sourceUrl}
            href={sourceUrl}
            className="md:col-span-2"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Full Document</h2>
            <p className="mt-0.5 truncate text-xs text-slate-500">
              Complete judgment text stored in `ik_judgments`.
            </p>
          </div>
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50"
            >
              Open on Indian Kanoon
            </a>
          ) : null}
        </div>
        {hasHtmlDoc ? (
          <iframe
            title={upload.originalFilename || 'Judgment document'}
            sandbox=""
            srcDoc={htmlDoc}
            className="h-[70vh] w-full bg-white"
          />
        ) : (
          <div className="h-[70vh] overflow-y-auto whitespace-pre-wrap px-4 py-3 text-sm leading-6 text-slate-800">
            {textPreview || 'No document text is stored for this judgment.'}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">Document Overview</h3>
        </div>
        <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
          <OverviewField
            label="Merged Text"
            value={textPreview.length}
            hint="Characters from Elasticsearch"
          />
          <OverviewField
            label="Elasticsearch"
            value={upload.esDocId || 'Pending'}
            hint="Full-text search document reference"
          />
          <OverviewField
            label="Source URL"
            value={sourceUrl || 'Not provided'}
            hint="Indian Kanoon origin"
            href={sourceUrl}
          />
          <OverviewField
            label="Source Type"
            value={judgment.source_type || detail.sourceType || 'ik_pipeline'}
            hint="Pipeline that inserted this judgment"
          />
        </div>
      </section>
    </div>
  );
};

const MetadataField = ({ label, value, className = '', href = '' }) => {
  const display = value == null || value === '' ? 'N/A' : value;

  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 ${className}`.trim()}>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      {href && display !== 'N/A' ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="mt-0.5 block break-all text-sm font-medium text-blue-700 hover:underline"
        >
          {display}
        </a>
      ) : (
        <div className="mt-0.5 break-all text-sm font-medium text-slate-900">{display}</div>
      )}
    </div>
  );
};

const OverviewField = ({ label, value, hint, href = '' }) => (
  <div className="px-4 py-3">
    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    {href && value && value !== 'Not provided' ? (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="mt-1 block truncate text-sm font-semibold text-blue-700 hover:underline"
        title={String(value)}
      >
        {value}
      </a>
    ) : (
      <div className="mt-1 truncate text-sm font-semibold text-slate-900" title={String(value)}>
        {value}
      </div>
    )}
    <div className="mt-0.5 text-[11px] text-slate-500">{hint}</div>
  </div>
);

function formatJudgmentDate(value) {
  if (!value) return 'N/A';
  const iso = String(value).slice(0, 10);
  return iso || 'N/A';
}

export default PipelineInspectDashboard;
