#!/usr/bin/env node

const pool = require('../config/db');
const {
  COLLECTION_NAME,
  deletePointsByIds,
  scrollPoints,
} = require('../services/qdrantService');

const PAGE_SIZE = Math.max(50, Number(process.env.QDRANT_SCROLL_PAGE_SIZE || 500));
const DELETE_BATCH_SIZE = Math.max(50, Number(process.env.QDRANT_DELETE_BATCH_SIZE || 500));

function parseArgs(argv) {
  return {
    apply: argv.includes('--apply'),
  };
}

function chunkArray(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function loadPgChunkSnapshot() {
  const result = await pool.query(`
    SELECT
      chunk_id::text AS chunk_id,
      judgment_uuid::text AS judgment_uuid
    FROM judgment_chunks
  `);

  return {
    chunkIds: new Set(result.rows.map((row) => row.chunk_id)),
    judgmentUuids: new Set(
      result.rows
        .map((row) => row.judgment_uuid)
        .filter(Boolean)
    ),
    rowCount: result.rows.length,
  };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  const pgSnapshot = await loadPgChunkSnapshot();
  const qdrantJudgmentUuids = new Set();
  const orphanPointIds = [];
  let totalQdrantPoints = 0;
  let nextPageOffset = null;
  let hasEnsuredCollection = false;

  console.log(`[cleanupLegalEmbeddingsV2] mode=${apply ? 'apply' : 'dry-run'} collection=${COLLECTION_NAME}`);

  do {
    const page = await scrollPoints({
      collectionName: COLLECTION_NAME,
      limit: PAGE_SIZE,
      offset: nextPageOffset,
      withPayload: true,
      withVector: false,
      skipEnsureCollection: hasEnsuredCollection,
    });
    hasEnsuredCollection = true;

    for (const point of page.points) {
      totalQdrantPoints += 1;
      const pointId = String(point.id || '').trim();
      const judgmentUuid = String(point.payload?.judgment_uuid || '').trim();

      if (judgmentUuid) {
        qdrantJudgmentUuids.add(judgmentUuid);
      }

      if (pointId && !pgSnapshot.chunkIds.has(pointId)) {
        orphanPointIds.push(pointId);
      }
    }

    nextPageOffset = page.nextPageOffset;
  } while (nextPageOffset != null);

  let deletedPoints = 0;
  if (apply && orphanPointIds.length) {
    for (const batch of chunkArray(orphanPointIds, DELETE_BATCH_SIZE)) {
      await deletePointsByIds(COLLECTION_NAME, batch);
      deletedPoints += batch.length;
      console.log(`[cleanupLegalEmbeddingsV2] deleted batch size=${batch.length}`);
    }
  }

  const orphanJudgmentUuids = Array.from(qdrantJudgmentUuids).filter(
    (judgmentUuid) => !pgSnapshot.judgmentUuids.has(judgmentUuid)
  );

  const summary = {
    collection: COLLECTION_NAME,
    mode: apply ? 'apply' : 'dry-run',
    totalQdrantPoints,
    pgChunks: pgSnapshot.rowCount,
    orphanPointCount: orphanPointIds.length,
    deletedPoints,
    distinctQdrantJudgmentUuids: qdrantJudgmentUuids.size,
    orphanJudgmentUuidCount: orphanJudgmentUuids.length,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error('[cleanupLegalEmbeddingsV2] failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
