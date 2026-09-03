import React from 'react';
import { AlertTriangle, CheckCircle2, Copy, FileUp, LoaderCircle, UploadCloud } from 'lucide-react';

const inputClass =
  'w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none focus:border-blue-400';

const RESULT_STYLES = {
  indexed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  duplicate: 'border-amber-200 bg-amber-50 text-amber-800',
  failed: 'border-rose-200 bg-rose-50 text-rose-700',
};

const LibraryUploadForm = ({
  feedback,
  maxFiles,
  onUpload,
  onFieldChange,
  onOpenRecord,
  setUploadFiles,
  uploadFields,
  uploadFiles,
  uploadResults,
  uploading,
}) => {
  const selectionKey = uploadFiles.length
    ? uploadFiles.map((file) => `${file.name}:${file.size}`).join('|')
    : 'empty';
  const multi = uploadFiles.length > 1;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold text-slate-900">Judgment Library Upload</h1>
          <p className="mt-2 text-sm text-slate-600">
            Each PDF is converted to the exact Indian Kanoon record format and stored straight into the
            judgment library (<span className="font-mono text-xs">ik_judgments</span>), where citation research
            finds it for free. Elasticsearch is the only store; nothing is written anywhere else.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Text is read from the PDF's own text layer; scanned PDFs go through OCR. Title, court, date and judges are
            detected from the text — use the optional fields to set them yourself, and edit any record afterwards.
          </p>
        </div>

        <div className="grid w-full max-w-3xl gap-3">
          <label className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            <span className="mb-2 flex items-center gap-2 font-semibold text-slate-800">
              <FileUp className="h-4 w-4" />
              Choose judgment PDFs
            </span>
            <input
              key={selectionKey}
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="block w-full text-sm text-slate-600"
              onChange={(event) => setUploadFiles(Array.from(event.target.files || []))}
            />
            <span className="mt-2 block text-xs text-slate-500">
              {uploadFiles.length
                ? `${uploadFiles.length} file${uploadFiles.length === 1 ? '' : 's'} selected`
                : `No files selected · up to ${maxFiles} PDFs per upload`}
            </span>
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-sm text-slate-600 md:col-span-2">
              <span className="mb-1.5 block font-medium text-slate-800">
                Title <span className="font-normal text-slate-400">(optional; single file only, e.g. "A vs B on 22 October, 2024")</span>
              </span>
              <input
                value={uploadFields.title}
                disabled={multi}
                onChange={(event) => onFieldChange('title', event.target.value)}
                placeholder={multi ? 'Titles are detected per file when uploading several PDFs' : 'Detected from the judgment when left empty'}
                className={`${inputClass} disabled:opacity-60`}
              />
            </label>
            <label className="text-sm text-slate-600">
              <span className="mb-1.5 block font-medium text-slate-800">
                Court name <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <input
                value={uploadFields.docsource}
                onChange={(event) => onFieldChange('docsource', event.target.value)}
                placeholder="e.g. Karnataka High Court"
                className={inputClass}
              />
            </label>
            <label className="text-sm text-slate-600">
              <span className="mb-1.5 block font-medium text-slate-800">
                Judgment date <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <input
                type="date"
                value={uploadFields.publishdate}
                onChange={(event) => onFieldChange('publishdate', event.target.value)}
                className={inputClass}
              />
            </label>
            <label className="text-sm text-slate-600">
              <span className="mb-1.5 block font-medium text-slate-800">
                Author <span className="font-normal text-slate-400">(optional)</span>
              </span>
              <input
                value={uploadFields.author}
                onChange={(event) => onFieldChange('author', event.target.value)}
                placeholder="Judge who wrote the opinion"
                className={inputClass}
              />
            </label>
            <label className="text-sm text-slate-600">
              <span className="mb-1.5 block font-medium text-slate-800">
                Bench <span className="font-normal text-slate-400">(optional, comma separated)</span>
              </span>
              <input
                value={uploadFields.bench}
                onChange={(event) => onFieldChange('bench', event.target.value)}
                placeholder="e.g. Ramesh Sinha, Ravindra Kumar Agrawal"
                className={inputClass}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={onUpload}
            disabled={uploading || !uploadFiles.length}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {uploading ? 'Converting and storing…' : 'Store in Judgment Library'}
          </button>
        </div>
      </div>

      {feedback ? (
        <div
          className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
            feedback.tone === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.message}
        </div>
      ) : null}

      {uploadResults?.results?.length ? (
        <div className="mt-5 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last upload</div>
          {uploadResults.results.map((result, index) => (
            <div
              key={`${result.filename}-${index}`}
              className={`rounded-2xl border px-4 py-3 text-sm ${RESULT_STYLES[result.status] || RESULT_STYLES.failed}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {result.status === 'indexed' ? (
                    <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  ) : result.status === 'duplicate' ? (
                    <Copy className="h-4 w-4 flex-shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  )}
                  <span className="truncate font-semibold">{result.filename}</span>
                  <span className="text-xs uppercase tracking-wide">{result.status}</span>
                </div>
                {result.tid ? (
                  <button
                    type="button"
                    onClick={() => onOpenRecord(result.tid)}
                    className="rounded-lg border border-current/30 bg-white/60 px-2.5 py-1 text-xs font-semibold"
                  >
                    View {result.tid}
                  </button>
                ) : null}
              </div>
              {result.status === 'indexed' ? (
                <div className="mt-1 text-xs">
                  {result.title} · {result.docsource || 'court unknown'} · {result.publishdate || 'no date'} ·{' '}
                  {result.paragraphCount} paragraphs · {result.upload?.text_source === 'ocr' ? 'OCR' : 'text layer'}
                </div>
              ) : null}
              {result.status === 'duplicate' ? (
                <div className="mt-1 text-xs">
                  Already in the library as “{result.existing?.title || result.tid}”.
                </div>
              ) : null}
              {result.error ? <div className="mt-1 text-xs">{result.error}</div> : null}
              {result.warnings?.length ? (
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
};

export default LibraryUploadForm;
