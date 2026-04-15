import React from 'react';
import {
  ArrowLeft,
  Clock3,
  FileStack,
  ScanText,
  ShieldCheck,
  Text,
} from 'lucide-react';
import ChunkPreviewCard from './ChunkPreviewCard';
import IndexReferencesCard from './IndexReferencesCard';
import MetadataWorkspace from './MetadataWorkspace';
import PagePreviewCard from './PagePreviewCard';
import TextPreviewCard from './TextPreviewCard';
import VectorPreviewCard from './VectorPreviewCard';
import { STATUS_STYLES } from './constants';
import { formatDuration, prettyStatus } from './helpers';

const DocumentInspectDashboard = ({
  detailLoading,
  detailStatus,
  metadataForm,
  onBack,
  onMetadataFieldChange,
  onReprocess,
  onSaveMetadata,
  reprocessing,
  savingMetadata,
  selectedDetail,
  selectedDocumentId,
  selectedUpload,
  textPreview,
}) => {
  if (!selectedDocumentId) {
    return null;
  }

  const upload = selectedDetail?.upload || selectedUpload || {};
  const chunks = selectedDetail?.chunks || [];
  const pages = selectedDetail?.pages || [];
  const aliases = selectedDetail?.aliases || [];
  const pipelineMetrics = upload.pipelineMetrics || {};
  const hasDocumentAiOcr =
    Number(upload.ocrPagesCount || 0) > 0 || Number(upload.ocrBatchesCount || 0) > 0;
  const hasOcrPages = pages.some(
    (page) =>
      page.ocr_json_path ||
      (page.page_type && String(page.page_type).toUpperCase() !== 'TEXT_PAGE')
  );
  const indexedVectors = chunks.filter(
    (chunk) => chunk.qdrant_point_id || chunk.embedding_status === 'indexed'
  ).length;

  const statCards = [
    {
      label: 'Total Pages',
      value: upload.totalPages || pages.length || 0,
      detail: `Text ${upload.textPagesCount || 0} • OCR ${upload.ocrPagesCount || 0}`,
      icon: FileStack,
    },
    {
      label: 'Chunks',
      value: chunks.length,
      detail: `${indexedVectors} indexed vectors`,
      icon: Text,
    },
    {
      label: 'Vectors',
      value: indexedVectors,
      detail: upload.qdrantCollection || 'Qdrant pending',
      icon: ScanText,
    },
    {
      label: 'Aliases',
      value: aliases.length,
      detail: upload.canonicalId || 'Canonical ID pending',
      icon: ShieldCheck,
    },
    {
      label: 'Pipeline Time',
      value: formatDuration(pipelineMetrics.totalDurationMs),
      detail: pipelineMetrics.ocrMode ? `OCR mode ${pipelineMetrics.ocrMode}` : 'Timing summary',
      icon: Clock3,
    },
  ];

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
              Back To Pipeline Monitor
            </button>

            <div className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              Document Inspect Dashboard
            </div>
            <h2 className="mt-2 truncate text-2xl font-semibold text-slate-900">
              {selectedUpload?.originalFilename || 'Judgment document'}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>{upload.canonicalId || upload.documentId || selectedDocumentId}</span>
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
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-600">
            <div className="font-semibold text-slate-900">Document ID</div>
            <div className="mt-1 break-all">{selectedDocumentId}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => (
          <div key={card.label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {card.label}
                </div>
                <div className="mt-2 text-2xl font-bold text-slate-900">{card.value}</div>
                <div className="mt-2 text-xs text-slate-500">{card.detail}</div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-600">
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 2xl:grid-cols-[1.3fr,0.7fr]">
        <MetadataWorkspace
          cardClassName="h-full"
          description={
            selectedUpload
              ? `Review metadata, pipeline timings, and document stats for ${selectedUpload.originalFilename}.`
              : undefined
          }
          detailLoading={detailLoading}
          detailStatus={detailStatus}
          metadataForm={metadataForm}
          onMetadataFieldChange={onMetadataFieldChange}
          onReprocess={onReprocess}
          onSaveMetadata={onSaveMetadata}
          reprocessing={reprocessing}
          savingMetadata={savingMetadata}
          selectedDetail={selectedDetail}
          selectedDocumentId={selectedDocumentId}
          selectedUpload={selectedUpload}
          title="Document Workspace"
        />

        <div className="space-y-6">
          <IndexReferencesCard selectedDetail={selectedDetail} />
          <VectorPreviewCard
            chunks={chunks}
            documentId={selectedDocumentId}
            qdrantCollection={upload.qdrantCollection || selectedDetail?.judgment?.qdrant_collection}
          />
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <TextPreviewCard textPreview={textPreview} />
        <ChunkPreviewCard chunks={chunks} />
      </section>

      <section className={`grid gap-6 ${hasOcrPages ? 'xl:grid-cols-2' : ''}`}>
        {hasOcrPages ? <PagePreviewCard pages={pages} documentId={selectedDocumentId} /> : null}
        <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Document Overview</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {hasDocumentAiOcr ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">OCR Batches</div>
                <div className="mt-2 text-2xl font-bold text-slate-900">
                  {upload.ocrBatchesCount || 0}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  {upload.lastProgressMessage || 'Pipeline idle'}
                </div>
              </div>
            ) : null}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Merged Text</div>
              <div className="mt-2 text-2xl font-bold text-slate-900">{textPreview.length}</div>
              <div className="mt-2 text-xs text-slate-500">Characters in merged clean text</div>
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
              <div className="mt-2 text-xs text-slate-500">Original source captured for this upload</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DocumentInspectDashboard;
