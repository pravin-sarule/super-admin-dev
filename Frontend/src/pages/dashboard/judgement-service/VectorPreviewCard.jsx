import React, { useEffect, useMemo, useState } from 'react';
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
      <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Vector Preview</h3>
            <p className="mt-1 text-sm text-slate-500">
              Qdrant vector references and embedding state for this judgment.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-600">
            <ScanSearch className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <div>
            <span className="font-medium text-slate-800">Collection:</span>{' '}
            {qdrantCollection || 'Pending'}
          </div>
          <div className="mt-1">
            <span className="font-medium text-slate-800">Indexed vectors:</span>{' '}
            {indexedChunks.length}
          </div>
        </div>

        {previewError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {previewError}
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {vectorRows.map((chunk) => {
            const pointId = chunk.qdrant_point_id || chunk.chunk_id;
            const isLoading = loadingPointId === pointId;

            return (
              <button
                key={chunk.chunk_id}
                type="button"
                onClick={() => openVectorPreview(chunk)}
                className="block w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Chunk #{chunk.chunk_index}</div>
                    <div className="mt-1 break-all text-xs text-slate-500">
                      {pointId}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>Status: {chunk.embedding_status || 'pending'}</div>
                    <div>Model: {chunk.embedding_model || 'Pending'}</div>
                    <div className="mt-2 font-semibold text-blue-600">
                      {isLoading ? 'Loading preview...' : 'Click to preview vector'}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {indexedChunks.length > PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <div className="text-xs text-slate-500">
                Showing {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, indexedChunks.length)} of {indexedChunks.length} vectors
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(0, value - 1))}
                  disabled={currentPage === 0}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.min(totalPages - 1, value + 1))}
                  disabled={currentPage >= totalPages - 1}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}

          {!vectorRows.length && (
            <p className="text-sm text-slate-500">
              Vector references will appear once chunk embedding and Qdrant indexing complete.
            </p>
          )}
        </div>
      </div>

      {selectedVector ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 md:p-6">
          <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex flex-none items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  Vector Embedding Preview
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Chunk #{selectedVector.chunkIndex} • Dimension {selectedVector.dimension}
                </p>
                <p className="mt-1 break-all text-xs text-slate-500">{selectedVector.pointId}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedVector(null)}
                className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid flex-none gap-4 border-b border-slate-200 px-6 py-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {selectedVector.embeddingStatus || 'indexed'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Model</div>
                <div className="mt-2 break-all text-sm font-semibold text-slate-900">
                  {selectedVector.embeddingModel || 'Pending'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Collection</div>
                <div className="mt-2 break-all text-sm font-semibold text-slate-900">
                  {qdrantCollection || 'Pending'}
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div className="rounded-2xl bg-slate-950 p-6 text-xs font-mono leading-relaxed text-emerald-400 shadow-inner">
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
                  <div className="text-center text-slate-500 py-10">
                    No vector data available for this chunk.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default VectorPreviewCard;
