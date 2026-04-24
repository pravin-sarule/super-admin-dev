import React from 'react';
import { LoaderCircle, RefreshCw, Save } from 'lucide-react';
import { STATUS_STYLES } from './constants';
import { buildMetadataForm, formatDuration, prettyStatus } from './helpers';

function isMetadataFormDirty(currentForm, pristineForm) {
  if (!currentForm || !pristineForm) return false;
  return Object.keys(pristineForm).some((key) => {
    const current = String(currentForm[key] ?? '').trim();
    const pristine = String(pristineForm[key] ?? '').trim();
    return current !== pristine;
  });
}

const MetadataWorkspace = ({
  cardClassName = '',
  description,
  detailLoading,
  detailStatus,
  metadataForm,
  onMetadataFieldChange,
  onReprocess,
  onSaveMetadata,
  reprocessing,
  savingMetadata,
  selectedDetail,
  selectedDocumentId,
  selectedUpload,
  title = 'Judgement Workspace',
}) => {
  const pipelineMetrics = selectedDetail?.upload?.pipelineMetrics || {};
  const duplicateDetection = selectedDetail?.upload?.metadata?.duplicateDetection || {};
  const duplicateMatches = Array.isArray(duplicateDetection.matches)
    ? duplicateDetection.matches
    : [];
  const timingStages = Object.entries(pipelineMetrics.stages || {}).sort(
    (left, right) => (left[1]?.order || 0) - (right[1]?.order || 0)
  );
  const pristineMetadataForm = buildMetadataForm(selectedDetail);
  const metadataDirty = isMetadataFormDirty(metadataForm, pristineMetadataForm);

  return (
    <div className={`rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm ${cardClassName}`.trim()}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">
            {description || (selectedUpload
              ? `Editing ${selectedUpload.originalFilename}`
              : 'Select a judgment to inspect its pipeline output.')}
          </p>
        </div>
        {detailStatus && (
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
              STATUS_STYLES[detailStatus] || STATUS_STYLES.uploaded
            }`}
          >
            {prettyStatus(detailStatus)}
          </span>
        )}
      </div>

      {!selectedDocumentId ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
          Choose an upload from the table to view OCR pages, metadata, aliases, and chunk output.
        </div>
      ) : detailLoading ? (
        <div className="rounded-3xl border border-slate-200 bg-slate-50 px-6 py-14 text-center text-sm text-slate-500">
          <LoaderCircle className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          Loading selected judgment...
        </div>
      ) : (
        <div className="space-y-5">
          {selectedDetail?.upload?.errorMessage && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              <div className="font-semibold text-rose-800">Pipeline Error</div>
              <div className="mt-1">{selectedDetail.upload.errorMessage}</div>
              {selectedDetail?.upload?.lastProgressMessage && (
                <div className="mt-2 text-xs text-rose-700/80">
                  Last step: {selectedDetail.upload.lastProgressMessage}
                </div>
              )}
            </div>
          )}

          {duplicateMatches.length > 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              <div className="font-semibold text-amber-950">Potential Duplicate Detected</div>
              <div className="mt-1 text-amber-800">
                {duplicateDetection.summary || 'This upload matched an existing judgment and was not indexed.'}
              </div>
              <div className="mt-4 space-y-3">
                {duplicateMatches.map((match, index) => (
                  <div key={`${match.candidate?.judgmentUuid || 'duplicate'}-${index}`} className="rounded-2xl border border-amber-200 bg-white px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold text-slate-900">
                        {match.candidate?.caseName || 'Existing judgment'}
                      </div>
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                        {match.candidate?.sourceBucket || 'existing'}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                        score {match.score || 0}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-slate-600">
                      {(match.reasons || []).join(', ') || 'metadata overlap'}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {match.candidate?.canonicalId || 'Canonical ID pending'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm text-slate-600">
            <span className="mb-2 block font-medium text-slate-800">Case Name</span>
            <input
              value={metadataForm.caseName}
              onChange={(event) => onMetadataFieldChange('caseName', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-400"
            />
          </label>

          <label className="text-sm text-slate-600">
            <span className="mb-2 block font-medium text-slate-800">Court Code</span>
            <input
              value={metadataForm.courtCode}
              onChange={(event) => onMetadataFieldChange('courtCode', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-400"
            />
          </label>

          <label className="text-sm text-slate-600">
            <span className="mb-2 block font-medium text-slate-800">Judgment Date</span>
            <input
              type="date"
              value={metadataForm.judgmentDate}
              onChange={(event) => onMetadataFieldChange('judgmentDate', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-400"
            />
          </label>

          <label className="text-sm text-slate-600">
            <span className="mb-2 block font-medium text-slate-800">Year</span>
            <input
              type="number"
              value={metadataForm.year}
              onChange={(event) => onMetadataFieldChange('year', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-400"
            />
          </label>

          <label className="text-sm text-slate-600 md:col-span-2">
            <span className="mb-2 block font-medium text-slate-800">Primary Citation</span>
            <input
              value={metadataForm.primaryCitation}
              onChange={(event) => onMetadataFieldChange('primaryCitation', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-400"
            />
          </label>

          <label className="text-sm text-slate-600 md:col-span-2">
            <span className="mb-2 block font-medium text-slate-800">Alternate Citations</span>
            <input
              value={metadataForm.alternateCitations}
              onChange={(event) => onMetadataFieldChange('alternateCitations', event.target.value)}
              placeholder="Comma separated citations"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-400"
            />
          </label>

          <label className="text-sm text-slate-600 md:col-span-2">
            <span className="mb-2 block font-medium text-slate-800">Source URL</span>
            <input
              value={metadataForm.sourceUrl}
              onChange={(event) => onMetadataFieldChange('sourceUrl', event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-400"
            />
          </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
          {metadataDirty ? (
            <button
              type="button"
              onClick={onSaveMetadata}
              disabled={savingMetadata}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
            >
              {savingMetadata ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Changes
            </button>
          ) : null}

          <button
            type="button"
            onClick={onReprocess}
            disabled={reprocessing}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            {reprocessing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Reprocess
          </button>

          {metadataDirty ? (
            <span className="text-xs font-medium text-amber-600">
              Unsaved changes — click Save Changes to persist and re-index.
            </span>
          ) : (
            <span className="text-xs text-slate-400">
              Metadata was auto-saved during extraction. Edit any field above to enable saving.
            </span>
          )}
          </div>

          <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pages</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{selectedDetail?.upload?.totalPages || 0}</div>
            <div className="mt-2 text-xs text-slate-500">
              Text {selectedDetail?.upload?.textPagesCount || 0} • OCR {selectedDetail?.upload?.ocrPagesCount || 0}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">OCR Batches</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{selectedDetail?.upload?.ocrBatchesCount || 0}</div>
            <div className="mt-2 text-xs text-slate-500">
              {selectedDetail?.upload?.lastProgressMessage || 'Pipeline idle'}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chunks</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{selectedDetail?.chunks?.length || 0}</div>
            <div className="mt-2 text-xs text-slate-500">
              Elastic {selectedDetail?.upload?.esDocId || 'pending'}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pipeline Time</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">
              {formatDuration(pipelineMetrics.totalDurationMs)}
            </div>
            <div className="mt-2 text-xs text-slate-500">
              {pipelineMetrics.ocrMode ? `OCR mode ${pipelineMetrics.ocrMode}` : 'Timing summary'}
            </div>
          </div>
          </div>

          {timingStages.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Stage Timings
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {timingStages.map(([stageKey, stage]) => (
                  <div key={stageKey} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-sm font-semibold text-slate-800">
                      {stage.label || prettyStatus(stageKey)}
                    </div>
                    <div className="mt-2 text-xl font-bold text-slate-900">
                      {formatDuration(stage.durationMs)}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {stage.status ? prettyStatus(stage.status) : 'Completed'}
                    </div>
                    {stage.details && (
                      <div className="mt-2 text-xs text-slate-500">
                        {stage.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MetadataWorkspace;
