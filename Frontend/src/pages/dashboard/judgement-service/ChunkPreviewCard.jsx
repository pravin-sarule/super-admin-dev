import React, { useEffect, useMemo, useState } from 'react';

const PAGE_SIZE = 2;

const ChunkPreviewCard = ({ chunks }) => {
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(chunks.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visibleChunks = useMemo(
    () => chunks.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE),
    [chunks, currentPage]
  );

  useEffect(() => {
    setPage(0);
  }, [chunks]);

  return (
    <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-900">Chunk Preview</h3>
      <div className="mt-4 flex h-[720px] flex-1 flex-col">
        <div className="flex-1 space-y-3 overflow-auto pr-1">
          {visibleChunks.map((chunk) => (
            <div key={chunk.chunk_id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Chunk #{chunk.chunk_index} • {chunk.char_start}-{chunk.char_end}
              </div>
              <div className="text-sm leading-6 text-slate-700">{chunk.chunk_text}</div>
            </div>
          ))}

          {!visibleChunks.length && (
            <p className="text-sm text-slate-500">
              Chunk data will appear after successful merge and embedding.
            </p>
          )}
        </div>

        {chunks.length > PAGE_SIZE ? (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <div className="text-xs text-slate-500">
              Showing {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, chunks.length)} of {chunks.length} chunks
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
      </div>
    </div>
  );
};

export default ChunkPreviewCard;
