#!/usr/bin/env node

const pool = require('../config/db');
const repository = require('../services/judgementRepository');
const { processDocument } = require('../services/processingService');

function parseArgs(argv) {
  const args = {
    documentId: null,
    limit: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === '--document-id' && argv[index + 1]) {
      args.documentId = argv[index + 1];
      index += 1;
    } else if (token === '--limit' && argv[index + 1]) {
      const value = Number(argv[index + 1]);
      args.limit = Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
      index += 1;
    }
  }

  return args;
}

async function loadTargetUploads({ documentId, limit }) {
  if (documentId) {
    const upload = await repository.getUpload(documentId);
    return upload ? [upload] : [];
  }

  const values = [];
  let limitClause = '';

  if (limit) {
    values.push(limit);
    limitClause = `LIMIT $${values.length}`;
  }

  const result = await pool.query(
    `
      SELECT document_id
      FROM judgment_uploads
      WHERE status <> 'archived'
      ORDER BY created_at ASC
      ${limitClause}
    `,
    values
  );

  return Promise.all(
    result.rows.map((row) => repository.getUpload(row.document_id))
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const uploads = (await loadTargetUploads(args)).filter(Boolean);

  if (!uploads.length) {
    console.log('[reprocessAdminUploads] no uploads found');
    return;
  }

  let completed = 0;
  let failed = 0;

  console.log(`[reprocessAdminUploads] starting count=${uploads.length}`);

  for (const upload of uploads) {
    console.log(`[reprocessAdminUploads] processing documentId=${upload.documentId} status=${upload.status}`);

    try {
      await repository.updateUpload(upload.documentId, {
        status: 'uploaded',
        error_message: null,
        last_progress_message: 'Bulk reprocessing started',
        processing_started_at: new Date(),
        processing_completed_at: null,
        pipeline_metrics: JSON.stringify({}),
      });

      await processDocument({
        documentId: upload.documentId,
        fileBuffer: null,
      });

      completed += 1;
    } catch (error) {
      failed += 1;
      console.error(`[reprocessAdminUploads] failed documentId=${upload.documentId}`);
      console.error(error.message || error);
    }
  }

  console.log(
    JSON.stringify(
      {
        total: uploads.length,
        completed,
        failed,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error('[reprocessAdminUploads] failed');
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
