const { PDFDocument } = require('pdf-lib');
const { downloadGsUriToBuffer } = require('./gcsService');
const { processDocumentRaw } = require('./documentAIService');
const { parseDocumentAIJson, remapSegmentPagesToDocument, splitIntoChunks } = require('./chunkingService');

const DEFAULT_CONCURRENCY = 6;
const DEFAULT_MAX_PAGES = 200;
const DEFAULT_BATCH_SIZE = 5;

/**
 * Split the PDF into small multi-page batches, run Document AI processDocument on each
 * batch in parallel, remap page indices, merge segments in order, then chunk.
 *
 * @param {string} gcsInputPath - gs://bucket/path.pdf
 * @param {{ heartbeat?: function, lap?: function, docId?: string }} opts
 * @returns {{ chunks: object[], totalPages: number, gcsOcrPath: string }}
 */
const ocrPdfToChunks = async (gcsInputPath, opts = {}) => {
  const heartbeat = opts.heartbeat || (() => {});
  const lap = opts.lap || (() => {});

  const maxPages = Math.max(1, Number(process.env.DOCUMENT_AI_PARALLEL_OCR_MAX_PAGES) || DEFAULT_MAX_PAGES);
  const concurrency = Math.max(
    1,
    Number(process.env.DOCUMENT_AI_PARALLEL_OCR_CONCURRENCY) || DEFAULT_CONCURRENCY
  );
  // Keep batches small: online processDocument has stricter page/size limits than batch LRO.
  const batchSize = Math.max(
    1,
    Math.min(15, Number(process.env.DOCUMENT_AI_PARALLEL_BATCH_SIZE) || DEFAULT_BATCH_SIZE)
  );

  const pdfBytes = await downloadGsUriToBuffer(gcsInputPath);
  const src = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pageCount = src.getPageCount();
  if (pageCount === 0) throw new Error('PDF has no pages');
  if (pageCount > maxPages) {
    throw new Error(
      `PDF has ${pageCount} pages (limit ${maxPages} for parallel OCR); use batch or raise DOCUMENT_AI_PARALLEL_OCR_MAX_PAGES`
    );
  }

  lap(`Building small PDF batches (≤${batchSize} pages each) from ${pageCount} pages…`);
  const batches = [];
  for (let start = 0; start < pageCount; start += batchSize) {
    const end = Math.min(start + batchSize, pageCount);
    const pageIndices = [];
    for (let p = start; p < end; p++) pageIndices.push(p);

    const out = await PDFDocument.create();
    const copied = await out.copyPages(src, pageIndices);
    copied.forEach((page) => out.addPage(page));
    batches.push({
      batchIndex: batches.length,
      firstPage1Based: start + 1,
      buffer: await out.save(),
    });
  }

  const numBatches = batches.length;
  lap(
    `Parallel Document AI: ${numBatches} batch(es) (≤${batchSize} pages each), concurrency=${Math.min(concurrency, numBatches)}`
  );

  const segmentsPerBatch = new Array(numBatches);
  let nextBatch = 0;
  const workerCount = Math.min(concurrency, numBatches);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const bi = nextBatch++;
        if (bi >= numBatches) break;
        const { firstPage1Based, buffer } = batches[bi];
        batches[bi].buffer = null;

        const docJson = await processDocumentRaw(Buffer.from(buffer));
        const rawSegs = parseDocumentAIJson(docJson);
        segmentsPerBatch[bi] = remapSegmentPagesToDocument(rawSegs, firstPage1Based);

        const done = bi + 1;
        if (done === numBatches || done % 2 === 0) {
          heartbeat(`Parallel batch OCR progress: ${done}/${numBatches} batch(es)`);
        }
      }
    })
  );

  const mergedSegments = segmentsPerBatch.flat();
  const chunks = splitIntoChunks(mergedSegments);
  const gcsOcrPath = `${gcsInputPath}#parallel-batch-ocr`;

  lap(
    `Merged ${mergedSegments.length} segment(s) from ${pageCount} pages (${numBatches} batches) → ${chunks.length} chunk(s)`
  );
  return { chunks, totalPages: pageCount, gcsOcrPath };
};

module.exports = { ocrPdfToChunks };
