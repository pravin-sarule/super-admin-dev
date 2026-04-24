import React from 'react';
import {
  ArrowLeft,
  FileStack,
  LoaderCircle,
  ScanText,
  ShieldCheck,
  Text,
} from 'lucide-react';
import judgementAdminApi from '../../../services/judgementAdminApi';
import ChunkPreviewCard from '../judgement-service/ChunkPreviewCard';
import IndexReferencesCard from '../judgement-service/IndexReferencesCard';
import TextPreviewCard from '../judgement-service/TextPreviewCard';
import VectorPreviewCard from '../judgement-service/VectorPreviewCard';
import { STATUS_STYLES } from '../judgement-service/constants';
import { prettyStatus } from '../judgement-service/helpers';
import { formatDateTime } from './helpers';

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
      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to pipeline report
          </button>
        </div>
        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
          <LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          Loading pipeline judgment...
        </div>
      </section>
    );
  }

  if (detailError || !detail) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to pipeline report
        </button>
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {detailError || 'Pipeline judgment not found'}
        </div>
      </section>
    );
  }

  const upload = detail.upload || {};
  const judgment = detail.judgment || {};
  const chunks = detail.chunks || [];
  const indexedVectors = chunks.filter(
    (chunk) => chunk.qdrant_point_id || chunk.embedding_status === 'indexed'
  ).length;
  const qdrantCollection = detail.stores?.qdrant?.collection
    || upload.qdrantCollection
    || judgment.qdrant_collection
    || null;
  const qdrantPointCount = detail.stores?.qdrant?.count || 0;
  const textPreview = String(detail.textPreview || upload.mergedText || '');
  const detailStatus = upload.status || judgment.status;

  const statCards = [
    {
      label: 'Chunks',
      value: chunks.length,
      detail: `${indexedVectors} indexed vectors`,
      icon: Text,
    },
    {
      label: 'Vectors in Qdrant',
      value: qdrantPointCount,
      detail: qdrantCollection || 'Qdrant pending',
      icon: ScanText,
    },
    {
      label: 'Aliases',
      value: (detail.aliases || []).length,
      detail: upload.canonicalId || 'Canonical ID pending',
      icon: ShieldCheck,
    },
    {
      label: 'Elasticsearch',
      value: detail.stores?.elasticsearch?.present ? 'Indexed' : 'Missing',
      detail: upload.esDocId || 'Pending',
      icon: FileStack,
    },
  ];

  const fetchPipelineVectors = (_id, pointIds) =>
    judgementAdminApi.pipelineReportVectors(judgmentUuid, pointIds);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to pipeline report
            </button>

            <div className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              User Pipeline Inspect
            </div>
            <h2 className="mt-2 truncate text-2xl font-semibold text-slate-900">
              {upload.originalFilename || judgment.case_name || 'Pipeline judgment'}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>{upload.canonicalId || judgment.canonical_id || judgmentUuid}</span>
              {detailStatus ? (
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                    STATUS_STYLES[detailStatus] || STATUS_STYLES.uploaded
                  }`}
                >
                  {prettyStatus(detailStatus)}
                </span>
              ) : null}
              {upload.createdAt ? (
                <span className="text-xs text-slate-500">
                  Inserted {formatDateTime(upload.createdAt)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-600">
            <div className="font-semibold text-slate-900">Judgment UUID</div>
            <div className="mt-1 break-all">{judgmentUuid}</div>
          </div>
        </div>

        {(detail.warnings || []).length ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">Store warnings</p>
            <div className="mt-2 space-y-1">
              {detail.warnings.map((warning) => (
                <p key={`${warning.store}-${warning.message}`}>
                  {warning.store}: {warning.message}
                </p>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {card.label}
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{card.value}</div>
                <div className="mt-2 break-all text-xs text-slate-500">{card.detail}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-600">
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Document Workspace</h2>
            <p className="text-sm text-slate-500">
              Metadata captured from Indian Kanoon for {upload.originalFilename || judgment.case_name || 'this judgment'}.
            </p>
          </div>
          {detailStatus ? (
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                STATUS_STYLES[detailStatus] || STATUS_STYLES.uploaded
              }`}
            >
              {prettyStatus(detailStatus)}
            </span>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
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
            value={upload.sourceUrl || judgment.citation_data?.source_url}
            className="md:col-span-2"
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <IndexReferencesCard selectedDetail={detail} />
        <VectorPreviewCard
          chunks={chunks}
          documentId={judgmentUuid}
          qdrantCollection={qdrantCollection}
          fetchVectors={fetchPipelineVectors}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <TextPreviewCard textPreview={textPreview} />
        <ChunkPreviewCard chunks={chunks} />
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Document Overview</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Merged Text</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{textPreview.length}</div>
            <div className="mt-2 text-xs text-slate-500">Characters fetched from Elasticsearch</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Elasticsearch</div>
            <div className="mt-2 break-all text-sm font-semibold text-slate-900">
              {upload.esDocId || 'Pending'}
            </div>
            <div className="mt-2 text-xs text-slate-500">Full-text search document reference</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source URL</div>
            <div className="mt-2 break-all text-sm font-semibold text-slate-900">
              {upload.sourceUrl || 'Not provided'}
            </div>
            <div className="mt-2 text-xs text-slate-500">Indian Kanoon origin captured during fallback</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Source Type</div>
            <div className="mt-2 break-all text-sm font-semibold text-slate-900">
              {judgment.source_type || detail.sourceType || 'ik_pipeline'}
            </div>
            <div className="mt-2 text-xs text-slate-500">Pipeline that inserted this judgment</div>
          </div>
        </div>
      </section>
    </div>
  );
};

const MetadataField = ({ label, value, className = '' }) => (
  <div className={`rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 ${className}`.trim()}>
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-1 break-all text-sm font-semibold text-slate-900">
      {value == null || value === '' ? 'N/A' : value}
    </div>
  </div>
);

function formatJudgmentDate(value) {
  if (!value) return 'N/A';
  const iso = String(value).slice(0, 10);
  return iso || 'N/A';
}

export default PipelineInspectDashboard;
