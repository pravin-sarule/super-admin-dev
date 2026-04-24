const { v4: uuidv4 } = require('uuid');
const repository = require('../services/judgementRepository');
const {
  createCanonicalId,
  normalizeCitationList,
} = require('../services/metadataService');
const { sanitizeFilename, uploadBuffer } = require('../services/storageService');
const { queueProcessing } = require('../services/processingService');
const { getDependencyHealth } = require('../services/dependencyHealthService');
const pipelineReportService = require('../services/pipelineReportService');
const { fetchPointsByIds } = require('../services/qdrantService');
const { getJudgmentDocument } = require('../services/elasticsearchService');
const { createLogger } = require('../utils/logger');

const logger = createLogger('Controller');

function normalizeIncomingFile(file, req) {
  if (!file) return null;

  if (file?.buffer) {
    return {
      documentId: file.documentId || req.judgementUploadContext?.documentId || null,
      buffer: file.buffer,
      originalFilename: file.originalname,
      mimeType: file.mimetype || 'application/pdf',
      sizeBytes: file.size || file.buffer.length,
      storageBucket: file.bucketName || null,
      storagePath: file.path || null,
      storageUri: file.uri || null,
    };
  }

  if (file?.path) {
    return {
      documentId: file.documentId || req.judgementUploadContext?.documentId || null,
      buffer: null,
      originalFilename: file.originalname,
      mimeType: file.mimetype || file.contentType || 'application/pdf',
      sizeBytes: file.size || 0,
      storageBucket: file.bucketName || null,
      storagePath: file.path,
      storageUri: file.uri || null,
    };
  }

  return null;
}

function parseIncomingFiles(req) {
  const requestFiles = [];

  if (req.file) {
    requestFiles.push(req.file);
  }

  if (Array.isArray(req.files)) {
    requestFiles.push(...req.files);
  } else if (req.files && typeof req.files === 'object') {
    Object.values(req.files).forEach((files) => {
      if (Array.isArray(files)) {
        requestFiles.push(...files);
      }
    });
  }

  const normalizedFiles = requestFiles
    .map((file) => normalizeIncomingFile(file, req))
    .filter(Boolean);

  if (normalizedFiles.length) {
    return normalizedFiles;
  }

  if (req.body?.fileBase64) {
    return [{
      documentId: req.judgementUploadContext?.documentId || null,
      buffer: Buffer.from(req.body.fileBase64, 'base64'),
      originalFilename: req.body.fileName || 'judgment.pdf',
      mimeType: req.body.mimeType || 'application/pdf',
      sizeBytes: Buffer.byteLength(req.body.fileBase64, 'base64'),
      storageBucket: null,
      storagePath: null,
      storageUri: null,
    }];
  }

  return [];
}

async function uploadJudgement(req, res) {
  const incomingFiles = parseIncomingFiles(req);

  const validIncomingFiles = incomingFiles.filter(
    (incomingFile) => incomingFile && (incomingFile.buffer?.length || incomingFile.storagePath)
  );

  if (!validIncomingFiles.length) {
    return res.status(400).json({
      success: false,
      message: 'A PDF document is required',
    });
  }

  logger.step('Upload batch accepted', {
    filesAccepted: validIncomingFiles.length,
    adminUserId: req.user?.id || null,
    adminRole: req.user?.role || null,
    maxUploadFiles: req.judgementUploadContext?.maxUploadFiles || null,
  });

  const createdUploads = await Promise.all(validIncomingFiles.map(async (incomingFile) => {
    const documentId = incomingFile.documentId || uuidv4();

    logger.step('Upload accepted', {
      documentId,
      originalFilename: incomingFile.originalFilename,
      mimeType: incomingFile.mimeType,
      sizeBytes: incomingFile.sizeBytes || incomingFile.buffer?.length || 0,
      uploadMode: incomingFile.storagePath ? 'streamed-to-gcs' : 'buffered',
      adminUserId: req.user?.id || null,
      adminRole: req.user?.role || null,
    });

    const storedFile = incomingFile.storagePath
      ? {
        bucketName: incomingFile.storageBucket,
        path: incomingFile.storagePath,
        uri: incomingFile.storageUri,
      }
      : await uploadBuffer(
        incomingFile.buffer,
        `judgements/original/${documentId}/${sanitizeFilename(incomingFile.originalFilename)}`,
        incomingFile.mimeType
      );

    const created = await repository.createUpload({
      documentId,
      originalFilename: incomingFile.originalFilename,
      sourceUrl: req.body?.source_url || req.body?.sourceUrl || null,
      storageBucket: storedFile.bucketName,
      storagePath: storedFile.path,
      storageUri: storedFile.uri,
      status: 'uploaded',
      adminUserId: req.user?.id || null,
      adminRole: req.user?.role || null,
    });

    queueProcessing({
      documentId,
      fileBuffer: incomingFile.buffer || null,
    });

    return created;
  }));

  return res.status(202).json({
    success: true,
    message:
      createdUploads.length === 1
        ? 'Judgment uploaded. OCR and indexing pipeline started.'
        : `${createdUploads.length} judgments uploaded. OCR and indexing pipelines started.`,
    upload: createdUploads[0],
    uploads: createdUploads,
    filesAccepted: createdUploads.length,
  });
}

async function listJudgements(req, res) {
  logger.flow('Listing judgment uploads', {
    search: req.query.search || '',
    status: req.query.status || 'all',
    adminUserId: req.user?.id || null,
  });
  const uploads = await repository.listUploads({
    search: req.query.search || '',
    status: req.query.status || 'all',
  });

  return res.json({
    success: true,
    uploads,
  });
}

async function getJudgementSummary(req, res) {
  logger.flow('Fetching judgment summary');
  const summary = await repository.getSummary();
  return res.json({
    success: true,
    summary,
  });
}

async function getPipelineReportSummary(req, res) {
  const sourceType = req.query.sourceType || 'ik_pipeline';

  logger.flow('Fetching pipeline report summary', {
    sourceType,
    adminUserId: req.user?.id || null,
  });

  const report = await pipelineReportService.getPipelineReportSummary({
    sourceType,
  });

  return res.json({
    success: true,
    ...report,
  });
}

async function listPipelineJudgments(req, res) {
  const sourceType = req.query.sourceType || 'ik_pipeline';
  const search = req.query.search || '';
  const limit = req.query.limit || 10;
  const offset = req.query.offset || 0;

  logger.flow('Listing pipeline report judgments', {
    sourceType,
    search,
    limit,
    offset,
    adminUserId: req.user?.id || null,
  });

  const report = await pipelineReportService.listPipelineJudgments({
    sourceType,
    search,
    limit,
    offset,
  });

  return res.json({
    success: true,
    ...report,
  });
}

async function getPipelineJudgmentDetail(req, res) {
  const { judgmentUuid } = req.params;

  logger.flow('Fetching pipeline judgment detail', {
    judgmentUuid,
    adminUserId: req.user?.id || null,
  });

  const detail = await pipelineReportService.getPipelineJudgmentDetail({ judgmentUuid });

  if (!detail) {
    return res.status(404).json({
      success: false,
      message: 'Pipeline judgment not found',
    });
  }

  return res.json({
    success: true,
    detail,
  });
}

async function getPipelineJudgmentVectors(req, res) {
  const { judgmentUuid } = req.params;
  const requestedPointIds = String(req.query.pointIds || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!requestedPointIds.length) {
    return res.status(400).json({
      success: false,
      message: 'At least one pointId is required',
    });
  }

  try {
    const result = await pipelineReportService.getPipelineJudgmentVectors({
      judgmentUuid,
      pointIds: requestedPointIds,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Pipeline judgment not found',
      });
    }

    if (!result.vectors.length) {
      return res.status(404).json({
        success: false,
        message: 'The requested vector point IDs were not found for this judgment.',
      });
    }

    return res.json({
      success: true,
      collection: result.collection,
      vectors: result.vectors,
    });
  } catch (error) {
    logger.error('Failed to load pipeline vectors', {
      judgmentUuid,
      error: error.message,
    });
    return res.status(500).json({
      success: false,
      message: 'Failed to communicate with the vector database.',
      details: error.message,
    });
  }
}

async function getDependencyHealthSummary(req, res) {
  logger.flow('Fetching dependency health', {
    adminUserId: req.user?.id || null,
  });

  const health = await getDependencyHealth();

  if (health.overallStatus !== 'healthy') {
    logger.warn('One or more judgment dependencies are unavailable', {
      overallStatus: health.overallStatus,
      unhealthyCount: health.unhealthyCount,
      dependencies: health.dependencies
        .filter((dependency) => dependency.status !== 'healthy')
        .map((dependency) => ({
          key: dependency.key,
          label: dependency.label,
          message: dependency.message,
        })),
    });
  }

  return res.json({
    success: true,
    ...health,
  });
}

async function getJudgementDetail(req, res) {
  logger.flow('Fetching judgment detail', {
    documentId: req.params.documentId,
  });
  const detail = await repository.getUploadDetail(req.params.documentId);

  if (!detail) {
    return res.status(404).json({
      success: false,
      message: 'Judgment upload not found',
    });
  }

  const esDocId = detail.upload?.esDocId || detail.judgment?.es_doc_id || detail.upload?.canonicalId;
  if (esDocId) {
    try {
      const esDocument = await getJudgmentDocument(esDocId);
      const esText = String(esDocument?.full_text || '');

      detail.upload = {
        ...detail.upload,
        mergedText: esText,
      };
      detail.textPreview = esText;
    } catch (error) {
      logger.warn('Failed to load Elasticsearch text preview for admin detail', {
        documentId: req.params.documentId,
        esDocId,
        reason: error.message,
      });
      detail.textPreview = '';
      detail.upload = {
        ...detail.upload,
        mergedText: '',
      };
    }
  } else {
    detail.textPreview = '';
    detail.upload = {
      ...detail.upload,
      mergedText: '',
    };
  }

  return res.json({
    success: true,
    detail,
  });
}

async function getPagePdf(req, res) {
  const { documentId, pageNumber } = req.params;
  logger.flow('Fetching PDF page from storage', { documentId, pageNumber });

  try {
    const detail = await repository.getUploadDetail(documentId);
    if (!detail) return res.status(404).send('Judgment not found');

    const pageRow = (detail.pages || []).find(p => String(p.page_number) === String(pageNumber));
    if (!pageRow || !pageRow.gcs_page_path) {
      return res.status(404).send('PDF page artifact not found');
    }

    const { downloadBuffer } = require('../services/storageService');
    const buffer = await downloadBuffer(pageRow.gcs_page_path);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="page-${pageNumber}.pdf"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    return res.end(buffer);
  } catch (error) {
    logger.error('Failed to fetch PDF page', { documentId, pageNumber, error: error.message });
    return res.status(500).send('Internal Server Error');
  }
}

async function getPageOcrLayout(req, res) {
  const { documentId, pageNumber } = req.params;
  try {
    const detail = await repository.getUploadDetail(documentId);
    const pageRow = (detail?.pages || []).find(p => String(p.page_number) === String(pageNumber));
    if (!pageRow || !pageRow.ocr_json_path) {
      return res.json({ success: false, message: 'No OCR JSON available' });
    }

    const { downloadBuffer } = require('../services/storageService');
    const { bucket } = require('../config/gcs');
    const buffer = await downloadBuffer(pageRow.ocr_json_path);
    const jsonObj = JSON.parse(buffer.toString('utf8'));

    // Compute the accurate page offset by checking which pages share this batch JSON
    const sameBatchPages = (detail?.pages || [])
      .filter(p => p.ocr_json_path === pageRow.ocr_json_path)
      .sort((a, b) => Number(a.page_number) - Number(b.page_number));

    // Find the 0-based index of our page within this batch
    const pageIndex = sameBatchPages.findIndex(p => String(p.page_number) === String(pageNumber));
    const targetOffset = pageIndex >= 0 ? pageIndex : 0;

    let docObj = jsonObj.document || jsonObj;
    let pageObj = (docObj.pages || [])[targetOffset];
    let fullText = docObj.text || '';

    if (jsonObj.mode === 'async_batch' && Array.isArray(jsonObj.outputFiles)) {
      // Find the page across all shards using targetOffset
      let accumulatedPagesCount = 0;
      for (const fileUri of jsonObj.outputFiles) {
        const match = String(fileUri || '').match(/^gs:\/\/([^/]+)\/?(.*)$/);
        if (match) {
          const shardBuffer = await bucket.file(match[2]).download().then(res => res[0]);
          const shardDoc = JSON.parse(shardBuffer.toString('utf8'));
          const shardPageCount = (shardDoc.pages || []).length;

          if (targetOffset >= accumulatedPagesCount && targetOffset < accumulatedPagesCount + shardPageCount) {
            const localOffset = targetOffset - accumulatedPagesCount;
            pageObj = (shardDoc.pages || [])[localOffset];
            fullText = shardDoc.text || '';
            break;
          }
          accumulatedPagesCount += shardPageCount;
        }
      }
    }

    if (!pageObj) {
      return res.json({ success: false, message: 'Page layout not found in OCR JSON' });
    }

    function extractText(layout) {
      if (!layout?.textAnchor?.textSegments) return '';
      return layout.textAnchor.textSegments.map(seg => {
        const start = Number(seg.startIndex || 0);
        const end = Number(seg.endIndex || 0);
        return fullText.slice(start, end);
      }).join('');
    }

    const layoutEntities = pageObj.blocks?.length ? pageObj.blocks :
      pageObj.paragraphs?.length ? pageObj.paragraphs :
        pageObj.lines?.length ? pageObj.lines :
          pageObj.tokens?.length ? pageObj.tokens : [];

    const blocks = layoutEntities.map(entity => {
      const text = extractText(entity.layout);
      const vertices = entity.layout?.boundingPoly?.normalizedVertices || [];
      let minX = 1, minY = 1, maxX = 0, maxY = 0;
      vertices.forEach(v => {
        const x = Number(v.x || 0);
        const y = Number(v.y || 0);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      });
      return {
        text: text.trim(),
        x: minX * 100,
        y: minY * 100,
        width: Math.max(0.5, (maxX - minX) * 100),
        height: Math.max(0.5, (maxY - minY) * 100)
      };
    }).filter(b => b.text);

    return res.json({
      success: true,
      dimensions: pageObj.dimension || null,
      blocks
    });
  } catch (error) {
    logger.error('Failed to fetch OCR layout', { documentId, pageNumber, error: error.message });
    return res.status(500).json({ success: false, message: error.message });
  }
}

async function getJudgementStatus(req, res) {
  logger.flow('Fetching judgment status', {
    documentId: req.params.documentId,
  });
  const upload = await repository.getUpload(req.params.documentId);

  if (!upload) {
    return res.status(404).json({
      success: false,
      message: 'Judgment upload not found',
    });
  }

  return res.json({
    success: true,
    status: {
      documentId: upload.documentId,
      status: upload.status,
      message: upload.lastProgressMessage,
      errorMessage: upload.errorMessage,
      totalPages: upload.totalPages,
      textPagesCount: upload.textPagesCount,
      ocrPagesCount: upload.ocrPagesCount,
      ocrBatchesCount: upload.ocrBatchesCount,
      pipelineMetrics: upload.pipelineMetrics,
      processingCompletedAt: upload.processingCompletedAt,
    },
  });
}

async function getJudgementVectors(req, res) {
  const { documentId } = req.params;
  const requestedPointIds = String(req.query.pointIds || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!requestedPointIds.length) {
    return res.status(400).json({
      success: false,
      message: 'At least one pointId is required',
    });
  }

  logger.flow('Fetching judgment vectors', {
    documentId,
    requestedPointIds,
  });

  const detail = await repository.getUploadDetail(documentId);

  if (!detail?.upload) {
    return res.status(404).json({
      success: false,
      message: 'Judgment upload not found',
    });
  }

  const chunkByPointId = new Map(
    (detail.chunks || [])
      .filter((chunk) => chunk.qdrant_point_id)
      .map((chunk) => [String(chunk.qdrant_point_id), chunk])
  );

  const allowedPointIds = requestedPointIds.filter((pointId) => chunkByPointId.has(pointId));

  if (!allowedPointIds.length) {
    logger.warn('No matching vectors found for requested pointIds', {
      documentId,
      requested: requestedPointIds,
      availableCount: chunkByPointId.size,
    });
    return res.status(404).json({
      success: false,
      message: 'The requested vector point IDs were not found in the database for this judgment.',
    });
  }

  try {
    const { fetchPointsByIds } = require('../services/qdrantService');
    const qdrantPoints = await fetchPointsByIds(allowedPointIds);

    if (!qdrantPoints || qdrantPoints.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'The requested vectors were not found in the Qdrant collection.',
      });
    }

    const vectors = allowedPointIds
      .map((pointId) => {
        const chunk = chunkByPointId.get(pointId);
        const qPoint = qdrantPoints.find((p) => String(p.id) === String(pointId));
        if (!qPoint) return null;

        const vector = Array.isArray(qPoint.vector)
          ? qPoint.vector
          : Array.isArray(qPoint.vector?.default)
            ? qPoint.vector.default
            : [];

        return {
          pointId,
          chunkId: chunk.chunk_id,
          chunkIndex: chunk.chunk_index,
          vector,
          dimension: vector.length,
          embeddingStatus: chunk.embedding_status,
          embeddingModel: chunk.embedding_model,
        };
      })
      .filter(Boolean);

    return res.json({
      success: true,
      collection: detail.upload.qdrantCollection || null,
      vectors,
    });
  } catch (error) {
    logger.error('Error fetching from Qdrant', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Failed to communicate with the vector database.',
      details: error.message,
    });
  }
}

async function reprocessJudgement(req, res) {
  logger.step('Reprocess requested', {
    documentId: req.params.documentId,
    adminUserId: req.user?.id || null,
  });
  const upload = await repository.getUpload(req.params.documentId);

  if (!upload) {
    return res.status(404).json({
      success: false,
      message: 'Judgment upload not found',
    });
  }

  await repository.updateUpload(req.params.documentId, {
    status: 'uploaded',
    error_message: null,
    last_progress_message: 'Reprocessing queued',
    pipeline_metrics: JSON.stringify({}),
    processing_started_at: new Date(),
    processing_completed_at: null,
  });

  queueProcessing({
    documentId: req.params.documentId,
    fileBuffer: null,
  });

  return res.json({
    success: true,
    message: 'Judgment reprocessing started',
  });
}

async function reprocessFailedJudgements(req, res) {
  logger.step('Reprocess all failed requested', {
    adminUserId: req.user?.id || null,
  });

  const uploads = await repository.listUploads({ status: 'failed' });

  if (!uploads || uploads.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'No failed judgments found to reprocess',
    });
  }

  const { queueProcessing } = require('../services/processingService');
  let queuedCount = 0;

  for (const upload of uploads) {
    await repository.updateUpload(upload.documentId, {
      status: 'uploaded',
      error_message: null,
      last_progress_message: 'Reprocessing queued from bulk action',
      pipeline_metrics: JSON.stringify({}),
      processing_started_at: new Date(),
      processing_completed_at: null,
    });

    queueProcessing({
      documentId: upload.documentId,
      fileBuffer: null,
    });
    queuedCount++;
  }

  return res.json({
    success: true,
    message: `${queuedCount} failed judgments queued for reprocessing`,
    queuedCount,
  });
}

async function updateJudgementMetadata(req, res) {
  logger.step('Metadata update requested', {
    documentId: req.params.documentId,
    fields: Object.keys(req.body || {}),
    adminUserId: req.user?.id || null,
  });
  const detail = await repository.getUploadDetail(req.params.documentId);

  if (!detail?.upload) {
    return res.status(404).json({
      success: false,
      message: 'Judgment upload not found',
    });
  }

  const current = detail.upload.metadata || {};
  const nextMetadata = {
    ...current,
    ...req.body,
  };
  const normalizedMetadata = {
    ...nextMetadata,
    caseName: String(nextMetadata.caseName || detail.judgment?.case_name || '').trim(),
    courtCode: String(nextMetadata.courtCode || detail.judgment?.court_code || 'UNKNOWN').trim(),
    judgmentDate: nextMetadata.judgmentDate || detail.judgment?.judgment_date || null,
    year:
      nextMetadata.year != null && String(nextMetadata.year).trim() !== ''
        ? Number(nextMetadata.year)
        : detail.judgment?.year || null,
    primaryCitation: String(nextMetadata.primaryCitation || '').trim() || null,
    alternateCitations: normalizeCitationList(nextMetadata.alternateCitations || []),
    sourceUrl: String(nextMetadata.sourceUrl || detail.upload.sourceUrl || '').trim() || null,
  };

  if (normalizedMetadata.judgmentDate) {
    normalizedMetadata.year = Number(String(normalizedMetadata.judgmentDate).slice(0, 4));
  }

  normalizedMetadata.canonicalId = createCanonicalId({
    caseName: normalizedMetadata.caseName || detail.judgment?.case_name || detail.upload.originalFilename,
    courtCode: normalizedMetadata.courtCode || detail.judgment?.court_code || 'UNKNOWN',
    judgmentDate: normalizedMetadata.judgmentDate || null,
    year: normalizedMetadata.year || null,
    primaryCitation: normalizedMetadata.primaryCitation || null,
    alternateCitations: normalizedMetadata.alternateCitations || [],
  });

  await repository.updateUpload(req.params.documentId, {
    canonical_id: normalizedMetadata.canonicalId,
    metadata: JSON.stringify(normalizedMetadata),
  });

  if (detail.upload.judgmentUuid) {
    await repository.upsertJudgment({
      judgmentUuid: detail.upload.judgmentUuid,
      canonicalId: normalizedMetadata.canonicalId || detail.upload.canonicalId,
      caseName: normalizedMetadata.caseName || detail.judgment?.case_name || 'Untitled Judgment',
      courtCode: normalizedMetadata.courtCode || detail.judgment?.court_code || 'UNKNOWN',
      judgmentDate: normalizedMetadata.judgmentDate || detail.judgment?.judgment_date || null,
      year: normalizedMetadata.year || detail.judgment?.year || null,
      sourceType: 'admin-upload',
      verificationStatus: 'verified',
      confidenceScore: Number(normalizedMetadata.confidenceScore || detail.judgment?.confidence_score || 0.8),
      esDocId: detail.upload.esDocId || detail.judgment?.es_doc_id || null,
      status: detail.upload.status || 'completed',
      qdrantCollection: detail.upload.qdrantCollection || detail.judgment?.qdrant_collection || null,
      ocrInfo: detail.judgment?.ocr_info || {},
      citationData: {
        ...(detail.judgment?.citation_data || {}),
        primary_citation: normalizedMetadata.primaryCitation || null,
        alternate_citations: normalizedMetadata.alternateCitations || [],
        source_url: normalizedMetadata.sourceUrl || detail.upload.sourceUrl || null,
      },
    });
  }

  await repository.updateUpload(req.params.documentId, {
    status: 'uploaded',
    error_message: null,
    last_progress_message: 'Metadata saved. Reprocessing queued to refresh search indexes',
    processing_started_at: new Date(),
    processing_completed_at: null,
    pipeline_metrics: JSON.stringify({}),
  });

  queueProcessing({
    documentId: req.params.documentId,
    fileBuffer: null,
  });

  return res.json({
    success: true,
    message: 'Judgment metadata updated and reprocessing started',
    metadata: normalizedMetadata,
  });
}

async function deleteJudgment(req, res) {
  const { documentId } = req.params;

  logger.step('Deleting judgment requested', {
    documentId,
    adminUserId: req.user?.id || null,
  });

  const detail = await repository.getUploadDetail(documentId);

  if (!detail || !detail.upload) {
    return res.status(404).json({
      success: false,
      message: 'Judgment upload not found',
    });
  }

  const { upload } = detail;

  try {
    // 1. Delete from Elasticsearch if it exists
    if (upload.esDocId || upload.canonicalId) {
      const { deleteJudgmentDocument } = require('../services/elasticsearchService');
      await deleteJudgmentDocument(upload.esDocId || upload.canonicalId);
    }

    // 2. Delete from Qdrant if it exists
    if (upload.judgmentUuid) {
      const { deletePointsByJudgmentUuid } = require('../services/qdrantService');
      await deletePointsByJudgmentUuid(upload.qdrantCollection, upload.judgmentUuid);
    }

    // 3. Delete from GCS
    const { deleteDocumentDirectory } = require('../services/storageService');
    await deleteDocumentDirectory(documentId);

    // 4. Delete from Postgres
    await repository.deleteUploadAndJudgment(documentId);

    logger.info('Judgment fully deleted', { documentId });

    return res.json({
      success: true,
      message: 'Judgment deleted successfully from all stores',
    });
  } catch (error) {
    logger.error('Failed to fully delete judgment', { error: error.message, documentId });
    return res.status(500).json({
      success: false,
      message: 'Failed to fully delete judgment data',
      details: error.message,
    });
  }
}

async function archiveJudgment(req, res) {
  const { documentId } = req.params;

  logger.step('Archiving judgment requested', {
    documentId,
    adminUserId: req.user?.id || null,
  });

  const detail = await repository.getUploadDetail(documentId);

  if (!detail || !detail.upload) {
    return res.status(404).json({
      success: false,
      message: 'Judgment upload not found',
    });
  }

  try {
    await repository.updateUpload(documentId, {
      status: 'archived',
    });

    logger.info('Judgment archived', { documentId });

    return res.json({
      success: true,
      message: 'Judgment moved to archive',
    });
  } catch (error) {
    logger.error('Failed to archive judgment', { error: error.message, documentId });
    return res.status(500).json({
      success: false,
      message: 'Failed to archive judgment',
      details: error.message,
    });
  }
}

module.exports = {
  uploadJudgement,
  listJudgements,
  getJudgementSummary,
  getPipelineReportSummary,
  listPipelineJudgments,
  getPipelineJudgmentDetail,
  getPipelineJudgmentVectors,
  getDependencyHealthSummary,
  getJudgementDetail,
  getJudgementStatus,
  getJudgementVectors,
  reprocessJudgement,
  reprocessFailedJudgements,
  updateJudgementMetadata,
  deleteJudgment,
  archiveJudgment,
  getPagePdf,
  getPageOcrLayout,
};
