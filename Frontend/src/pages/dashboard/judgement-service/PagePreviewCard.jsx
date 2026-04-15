import React, { useEffect, useMemo, useState } from 'react';
import { Files, X, Loader2 } from 'lucide-react';
import judgementAdminApi from '../../../services/judgementAdminApi';

const PAGE_SIZE = 4;

const PagePreviewCard = ({ pages = [], documentId }) => {
  const [page, setPage] = useState(0);
  const [selectedPage, setSelectedPage] = useState(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [ocrLayout, setOcrLayout] = useState(null);
  const [loadingLayout, setLoadingLayout] = useState(false);

  const ocrPages = useMemo(
    () =>
      pages.filter(
        (pageRow) =>
          pageRow.ocr_json_path ||
          (pageRow.page_type && String(pageRow.page_type).toUpperCase() !== 'TEXT_PAGE')
      ),
    [pages]
  );

  const totalPages = Math.max(1, Math.ceil(ocrPages.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visiblePages = ocrPages.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [pages]);

  useEffect(() => {
    let urlToRevoke = null;

    if (selectedPage && documentId) {
      setLoadingPdf(true);
      setLoadingLayout(true);

      judgementAdminApi.getPagePdfBlob(documentId, selectedPage.page_number)
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          urlToRevoke = url;
          setPdfBlobUrl(url);
        })
        .catch((error) => console.error('Error fetching PDF blob:', error))
        .finally(() => setLoadingPdf(false));

      judgementAdminApi.getPageOcrLayout(documentId, selectedPage.page_number)
        .then((res) => {
          if (res.success && res.blocks) {
            setOcrLayout(res.blocks);
          } else {
            setOcrLayout(null);
          }
        })
        .catch((error) => console.error('Error fetching layout:', error))
        .finally(() => setLoadingLayout(false));
    } else {
      setPdfBlobUrl(null);
      setOcrLayout(null);
    }

    return () => {
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [selectedPage, documentId]);

  if (!ocrPages.length) {
    return null;
  }

  return (
    <>
      <div className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">OCR Page Preview</h3>
            <p className="mt-1 text-sm text-slate-500">
              Showing only pages that required OCR for this judgment.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-600">
            <Files className="h-5 w-5" />
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {visiblePages.map((pageRow) => (
            <div
              key={pageRow.page_id}
              onClick={() => setSelectedPage(pageRow)}
              className="cursor-pointer rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-blue-300 hover:bg-blue-50"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Page {pageRow.page_number}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {pageRow.page_type || 'OCR page'} • {pageRow.status || 'processed'}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <div>Chars: {pageRow.text_length || 0}</div>
                  <div>OCR JSON: {pageRow.ocr_json_path ? 'Available' : 'Pending'}</div>
                </div>
              </div>
            </div>
          ))}

          {ocrPages.length > PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4">
              <div className="text-xs text-slate-500">
                Showing {currentPage * PAGE_SIZE + 1}-{Math.min((currentPage + 1) * PAGE_SIZE, ocrPages.length)} of {ocrPages.length} OCR pages
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

      {selectedPage ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => setSelectedPage(null)}
          />
          <div className="relative flex h-full max-h-[90vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  OCR Page {selectedPage.page_number} Preview
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedPage.page_type} • Characters: {selectedPage.text_length || 0}
                </p>
              </div>
              <button
                onClick={() => setSelectedPage(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 grid-cols-2 flex-col lg:grid">
              {/* Original PDF Panel */}
              <div className="flex min-h-[300px] flex-col border-b border-slate-200 bg-slate-100/50 lg:border-b-0 lg:border-r">
                <div className="border-b border-slate-200 bg-white/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Original PDF - Page {selectedPage.page_number} Only (Virtualized)
                </div>
                <div className="relative flex-1 p-4">
                  {loadingPdf ? (
                    <div className="flex h-full flex-col items-center justify-center text-slate-400">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="mt-2 text-sm">Loading virtualized page artifact from storage...</span>
                    </div>
                  ) : pdfBlobUrl ? (
                    <iframe
                      src={`${pdfBlobUrl}#page=1&view=FitH`}
                      className="h-full w-full rounded-xl border border-slate-200 bg-white shadow-sm"
                      title={`Original Page ${selectedPage.page_number}`}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      <p className="text-sm">Store artifact unavailable</p>
                    </div>
                  )}
                </div>
              </div>

              {/* OCR Reconstructed Text Panel */}
              <div className="flex min-h-[300px] flex-col bg-slate-50">
                <div className="border-b border-slate-200 bg-white/50 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Reconstructed OCR Text - Page {selectedPage.page_number}
                </div>
                <div className="flex-1 overflow-auto p-4 bg-slate-100">
                  {loadingLayout ? (
                    <div className="flex h-full flex-col items-center justify-center text-slate-400">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span className="mt-2 text-sm">Parsing layout vectors...</span>
                    </div>
                  ) : ocrLayout && ocrLayout.length > 0 ? (
                    <div className="mx-auto bg-white shadow-md relative w-full h-full min-h-[800px] border border-slate-200" style={{ containerType: 'size' }}>
                      {ocrLayout.map((block, i) => (
                        <div
                          key={i}
                          className="absolute border border-transparent hover:border-blue-400 hover:bg-blue-50/50 text-slate-800"
                          style={{
                            left: `${block.x}%`,
                            top: `${block.y}%`,
                            width: `${block.width}%`,
                            height: `${block.height}%`,
                            fontSize: `clamp(6px, 1.2cqw, 14px)`,
                            display: 'flex',
                            alignItems: 'flex-start',
                            lineHeight: 1.15,
                          }}
                          title={block.text}
                        >
                          <div className="w-full text-left overflow-visible whitespace-pre-wrap word-break break-words">
                            {block.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : selectedPage.text_content ? (
                    <pre className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-6 font-mono text-xs leading-relaxed text-slate-700 shadow-sm">
                      {selectedPage.text_content}
                    </pre>
                  ) : (
                    <div className="flex h-full items-center justify-center text-slate-400">
                      <p className="text-sm italic">No text content extracted.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default PagePreviewCard;
