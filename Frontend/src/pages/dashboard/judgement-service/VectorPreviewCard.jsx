import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoaderCircle, ScanSearch, X } from 'lucide-react';
import judgementAdminApi from '../../../services/judgementAdminApi';

const PAGE_SIZE = 5;

const VectorPreviewCard = ({ chunks = [], documentId, qdrantCollection, fetchVectors }) => {
  const requestVectors = fetchVectors
    || ((id, pointIds) => judgementAdminApi.vectors(id, pointIds));
  const [page, setPage] = useState(0);
  const [loadingPointId, setLoadingPointId] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [vectorCache, setVectorCache] = useState({});
  const [selectedVector, setSelectedVector] = useState(null);

  const indexedChunks = useMemo(
    () => chunks.filter((chunk) => chunk.qdrant_point_id || chunk.embedding_status === 'indexed'),
    [chunks]
  );
  const totalPages = Math.max(1, Math.ceil(indexedChunks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const vectorRows = indexedChunks.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
    setSelectedVector(null);
    setPreviewError('');
  }, [documentId, chunks]);

  useEffect(() => {
    if (!selectedVector || typeof document === 'undefined') return undefined;

    const handleKey = (event) => {
      if (event.key === 'Escape') {
        setSelectedVector(null);
      }
    };

    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [selectedVector]);

  const openVectorPreview = async (chunk) => {
    const pointId = chunk.qdrant_point_id || chunk.chunk_id;

    if (!documentId || !pointId) {
      return;
    }

    if (vectorCache[pointId]) {
      setSelectedVector(vectorCache[pointId]);
      setPreviewError('');
      return;
    }

    setLoadingPointId(pointId);
    setPreviewError('');

    try {
      const response = await requestVectors(documentId, [pointId]);
      const vector = response.vectors?.[0] || null;

      if (!vector) {
        throw new Error('Vector preview is not available for this chunk');
      }

      setVectorCache((current) => ({
        ...current,
        [pointId]: vector,
      }));
      setSelectedVector(vector);
    } catch (error) {
      setPreviewError(error.response?.data?.message || error.message || 'Failed to load vector preview');
    } finally {
      setLoadingPointId(null);
    }
  };

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-900">Vector Preview</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Qdrant vector references and embedding state for this judgment.
            </p>
          </div>
          <ScanSearch className="mt-0.5 h-4 w-4 flex-none text-slate-400" />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-xs text-slate-600">
          <span>
            <span className="font-semibold text-slate-800">Collection</span>{' '}
            {qdrantCollection || 'Pending'}
          </span>
          <span className="text-slate-300">·</span>
          <span>
            <span className="font-semibold text-slate-800">Indexed vectors</span>{' '}
            {indexedChunks.length}
          </span>
        </div>

        {previewError ? (
          <div className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {previewError}
          </div>
        ) : null}

        <div className="divide-y divide-slate-100">
          {vectorRows.map((chunk) => {
            const pointId = chunk.qdrant_point_id || chunk.chunk_id;
            const isLoading = loadingPointId === pointId;

            return (
              <button
                key={chunk.chunk_id}
                type="button"
                onClick={() => openVectorPreview(chunk)}
                className="block w-full px-4 py-2.5 text-left transition hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-slate-900">Chunk #{chunk.chunk_index}</div>
                    <div className="mt-0.5 break-all text-[11px] text-slate-500">{pointId}</div>
                  </div>
                  <div className="text-right text-[11px] text-slate-500">
                    <div>{chunk.embedding_status || 'pending'} · {chunk.embedding_model || 'Pending'}</div>
                    <div className="mt-0.5 font-semibold text-blue-600">
                      {isLoading ? 'Loading...' : 'Preview vector'}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {indexedChunks.length > PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="text-[11px] text-slate-500">
                Showing {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, indexedChunks.length)} of {indexedChunks.length}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                  disabled={currentPage === 0}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}

          {!vectorRows.length ? (
            <p className="px-4 py-3 text-xs text-slate-500">
              Vector references will appear once chunk embedding and Qdrant indexing complete.
            </p>
          ) : null}
        </div>
      </section>

      {selectedVector && typeof document !== 'undefined'
        ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/60 p-4 md:p-6"
            onClick={() => setSelectedVector(null)}
          >
            <div
              className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex flex-none items-start justify-between gap-4 border-b border-slate-200 px-4 py-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Vector Embedding Preview
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Chunk #{selectedVector.chunkIndex} • Dimension {selectedVector.dimension}
                  </p>
                  <p className="mt-0.5 break-all text-[11px] text-slate-500">{selectedVector.pointId}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedVector(null)}
                  className="flex-none rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition hover:bg-slate-50"
                  aria-label="Close vector preview"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid flex-none gap-2 border-b border-slate-200 px-4 py-3 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Status</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-900">
                    {selectedVector.embeddingStatus || 'indexed'}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Model</div>
                  <div className="mt-0.5 break-all text-sm font-semibold text-slate-900">
                    {selectedVector.embeddingModel || 'Pending'}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Collection</div>
                  <div className="mt-0.5 break-all text-sm font-semibold text-slate-900">
                    {qdrantCollection || 'Pending'}
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                <div className="rounded-lg bg-slate-950 p-4 text-xs font-mono leading-relaxed text-emerald-400">
                  <div className="grid grid-cols-4 gap-x-6 gap-y-2 sm:grid-cols-6 md:grid-cols-8">
                    {(selectedVector.vector || []).map((value, index) => (
                      <div key={`${selectedVector.pointId}-${index}`} className="flex justify-between gap-1">
                        <span className="text-emerald-900/60">{index}</span>
                        <span className="font-medium text-emerald-400">
                          {typeof value === 'number' ? value.toFixed(6) : value}
                        </span>
                      </div>
                    ))}
                  </div>
                  {(!selectedVector.vector || selectedVector.vector.length === 0) && (
                    <div className="py-10 text-center text-slate-500">
                      No vector data available for this chunk.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
        : null}
    </>
  );
};

export default VectorPreviewCard;
