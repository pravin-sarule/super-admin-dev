const express = require('express');
const axios = require('axios');
const { protect, authorize } = require('../middleware/authMiddleware');
const logger = require('../config/logger');

const serviceBaseUrl = String(process.env.JUDGEMENT_SERVICE_URL || 'http://localhost:8095').replace(/\/+$/, '');
const internalServiceKey =
  process.env.JUDGEMENT_INTERNAL_API_KEY ||
  process.env.INTERNAL_SERVICE_KEY ||
  '';
const judmentApiKey =
  process.env.JUDMENT_API_KEY ||
  process.env.JUDGEMENT_API_KEY ||
  '';
const proxyTimeoutMs = Math.max(60000, Number(process.env.JUDGEMENT_PROXY_TIMEOUT_MS || 600000));

function buildHeaders(req, extraHeaders = {}) {
  return {
    Authorization: req.headers.authorization,
    'x-admin-user-id': req.user?.id != null ? String(req.user.id) : '',
    'x-admin-role': req.user?.role || '',
    'x-admin-email': req.user?.email || '',
    'x-request-id': req.requestId || '',
    ...(internalServiceKey ? { 'x-internal-service-key': internalServiceKey } : {}),
    ...extraHeaders,
  };
}

function hasMeaningfulBody(data) {
  if (data == null) return false;
  if (typeof data === 'string') return data.trim().length > 0;
  return true;
}

function buildJudmentApiHeaders(req, extraHeaders = {}) {
  return {
    'x-admin-user-id': req.user?.id != null ? String(req.user.id) : '',
    'x-admin-role': req.user?.role || '',
    'x-admin-email': req.user?.email || '',
    'x-request-id': req.requestId || '',
    ...(internalServiceKey ? { 'x-internal-service-key': internalServiceKey } : {}),
    ...(judmentApiKey ? { 'x-api-key': judmentApiKey } : {}),
    ...extraHeaders,
  };
}

async function forward(req, res, next, options) {
  const startedAt = Date.now();

  try {
    logger.info('Forwarding admin judgment request to judgement-service', {
      requestId: req.requestId,
      layer: 'JUDGEMENT_PROXY',
      method: options.method,
      path: options.path,
      adminUserId: req.user?.id,
      adminRole: req.user?.role,
      serviceBaseUrl,
    });

    const response = await axios({
      method: options.method,
      url: `${serviceBaseUrl}${options.path}`,
      params: options.params,
      data: options.data,
      headers: buildHeaders(req, options.headers),
      timeout: options.timeoutMs || proxyTimeoutMs,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    logger.info('judgement-service request completed', {
      requestId: req.requestId,
      layer: 'JUDGEMENT_PROXY',
      method: options.method,
      path: options.path,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    });

    if (
      options.path === '/api/judgements/dependencies/health' &&
      response.data?.overallStatus &&
      response.data.overallStatus !== 'healthy'
    ) {
      logger.warn('Judgement dependency health degraded', {
        requestId: req.requestId,
        layer: 'JUDGEMENT_PROXY',
        overallStatus: response.data.overallStatus,
        unhealthyCount: response.data.unhealthyCount || 0,
        dependencies: (response.data.dependencies || [])
          .filter((dependency) => dependency.status !== 'healthy')
          .map((dependency) => ({
            key: dependency.key,
            label: dependency.label,
            message: dependency.message,
          })),
      });
    }

    return res.status(response.status).json(response.data);
  } catch (error) {
    logger.error(`judgement-service request failed: ${error.message}`, {
      requestId: req.requestId,
      layer: 'JUDGEMENT_PROXY',
      method: options.method,
      path: options.path,
      durationMs: Date.now() - startedAt,
      upstreamStatus: error.response?.status,
      upstreamData: error.response?.data ?? null,
      stack: error.stack,
    });

    if (error.response) {
      res.setHeader('x-request-id', req.requestId || '');

      if (hasMeaningfulBody(error.response.data)) {
        return res.status(error.response.status).json(error.response.data);
      }

      return res.status(error.response.status).json({
        success: false,
        message: 'Judgement service returned an empty error response',
        upstreamStatus: error.response.status,
        upstreamPath: options.path,
        requestId: req.requestId || null,
      });
    }

    return next({
      statusCode: 502,
      code: 'JUDGEMENT_SERVICE_UNAVAILABLE',
      message: 'Judgement service is unavailable',
      details: error.message,
    });
  }
}

async function forwardJudmentApi(req, res, next, options) {
  const startedAt = Date.now();

  try {
    logger.info('Forwarding admin judgment search request to judment-api', {
      requestId: req.requestId,
      layer: 'JUDMENT_SEARCH_PROXY',
      method: options.method,
      path: options.path,
      adminUserId: req.user?.id,
      adminRole: req.user?.role,
      serviceBaseUrl,
    });

    const response = await axios({
      method: options.method,
      url: `${serviceBaseUrl}${options.path}`,
      params: options.params,
      data: options.data,
      headers: buildJudmentApiHeaders(req, options.headers),
      timeout: options.timeoutMs || proxyTimeoutMs,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    logger.info('judment-api request completed', {
      requestId: req.requestId,
      layer: 'JUDMENT_SEARCH_PROXY',
      method: options.method,
      path: options.path,
      statusCode: response.status,
      durationMs: Date.now() - startedAt,
    });

    return res.status(response.status).json(response.data);
  } catch (error) {
    logger.error(`judment-api request failed: ${error.message}`, {
      requestId: req.requestId,
      layer: 'JUDMENT_SEARCH_PROXY',
      method: options.method,
      path: options.path,
      durationMs: Date.now() - startedAt,
      upstreamStatus: error.response?.status,
      upstreamData: error.response?.data ?? null,
      stack: error.stack,
    });

    if ([401, 403].includes(Number(error.response?.status || 0))) {
      return next({
        statusCode: 502,
        code: 'JUDMENT_API_AUTH_FAILED',
        message: 'Judment search API authentication failed on backend',
        details: error.response?.data || error.message,
      });
    }

    if (error.response) {
      res.setHeader('x-request-id', req.requestId || '');

      if (hasMeaningfulBody(error.response.data)) {
        return res.status(error.response.status).json(error.response.data);
      }

      return res.status(error.response.status).json({
        success: false,
        message: 'Judment API returned an empty error response',
        upstreamStatus: error.response.status,
        upstreamPath: options.path,
        requestId: req.requestId || null,
      });
    }

    return next({
      statusCode: error.statusCode || 502,
      code: 'JUDMENT_API_UNAVAILABLE',
      message: error.message || 'Judment API is unavailable',
    });
  }
}

module.exports = (pool) => {
  const router = express.Router();

  router.use(protect(pool));
  router.use(authorize(['super-admin']));

  // ... (keeping existing routes but inside this scope)
  router.get('/summary', (req, res, next) =>
    forward(req, res, next, {
      method: 'GET',
      path: '/api/judgements/summary',
    })
  );

  router.post('/search/hybrid', (req, res, next) =>
    forwardJudmentApi(req, res, next, {
      method: 'POST',
      path: '/api/judment-api/search/hybrid',
      data: req.body,
      headers: {
        'content-type': 'application/json',
      },
      timeoutMs: Math.max(proxyTimeoutMs, 240000),
    })
  );

  router.post('/search/semantic', (req, res, next) =>
    forwardJudmentApi(req, res, next, {
      method: 'POST',
      path: '/api/judment-api/search/semantic',
      data: req.body,
      headers: {
        'content-type': 'application/json',
      },
      timeoutMs: Math.max(proxyTimeoutMs, 240000),
    })
  );

  router.post('/search/full-text', (req, res, next) =>
    forwardJudmentApi(req, res, next, {
      method: 'POST',
      path: '/api/judment-api/search/full-text',
      data: req.body,
      headers: {
        'content-type': 'application/json',
      },
      timeoutMs: Math.max(proxyTimeoutMs, 240000),
    })
  );

  router.get('/search/analytics', (req, res, next) =>
    forwardJudmentApi(req, res, next, {
      method: 'GET',
      path: '/api/judment-api/analytics',
      params: req.query,
    })
  );

  router.get('/dependencies/health', (req, res, next) =>
    forward(req, res, next, {
      method: 'GET',
      path: '/api/judgements/dependencies/health',
    })
  );

  router.get('/', (req, res, next) =>
    forward(req, res, next, {
      method: 'GET',
      path: '/api/judgements',
      params: req.query,
    })
  );

  router.post('/reprocess-failed', (req, res, next) =>
    forward(req, res, next, {
      method: 'POST',
      path: '/api/judgements/reprocess-failed',
    })
  );

  router.post('/upload', async (req, res, next) => {
    logger.info('Received admin judgement upload request', {
      requestId: req.requestId,
      layer: 'JUDGEMENT_PROXY',
      adminUserId: req.user?.id,
      adminRole: req.user?.role,
      contentType: req.headers['content-type'] || null,
      contentLength: req.headers['content-length'] || null,
    });

    return forward(req, res, next, {
      method: 'POST',
      path: '/api/judgements/upload',
      data: req,
      headers: {
        ...(req.headers['content-type'] ? { 'content-type': req.headers['content-type'] } : {}),
        ...(req.headers['content-length'] ? { 'content-length': req.headers['content-length'] } : {}),
      },
      timeoutMs: Math.max(proxyTimeoutMs, 900000),
    });
  });

  router.get('/:documentId/status', (req, res, next) =>
    forward(req, res, next, {
      method: 'GET',
      path: `/api/judgements/${req.params.documentId}/status`,
    })
  );

  router.get('/:documentId/vectors', (req, res, next) => {
    logger.info('Proxying vectors request', {
      documentId: req.params.documentId,
      pointIds: req.query.pointIds,
    });
    return forward(req, res, next, {
      method: 'GET',
      path: `/api/judgements/${req.params.documentId}/vectors`,
      params: req.query,
    });
  });

  router.get('/:documentId/pages/:pageNumber/ocr-layout', (req, res, next) =>
    forward(req, res, next, {
      method: 'GET',
      path: `/api/judgements/${req.params.documentId}/pages/${req.params.pageNumber}/ocr-layout`,
    })
  );

  router.get('/:documentId/pages/:pageNumber/ocr-layout', (req, res, next) =>
    forward(req, res, next, {
      method: 'GET',
      path: `/api/judgements/${req.params.documentId}/pages/${req.params.pageNumber}/ocr-layout`,
    })
  );

  router.get('/:documentId/pages/:pageNumber/pdf', async (req, res, next) => {
    const startedAt = Date.now();
    const path = `/api/judgements/${req.params.documentId}/pages/${req.params.pageNumber}/pdf`;
    
    try {
      logger.info('Forwarding admin judgment request to judgement-service (STREAM)', {
        requestId: req.requestId,
        layer: 'JUDGEMENT_PROXY',
        method: 'GET',
        path,
        adminUserId: req.user?.id,
      });

      const response = await axios({
        method: 'GET',
        url: `${serviceBaseUrl}${path}`,
        headers: buildHeaders(req),
        responseType: 'stream',
        timeout: proxyTimeoutMs,
      });

      res.setHeader('Content-Type', response.headers['content-type'] || 'application/pdf');
      if (response.headers['content-disposition']) {
        res.setHeader('Content-Disposition', response.headers['content-disposition']);
      }
      if (response.headers['cache-control']) {
        res.setHeader('Cache-Control', response.headers['cache-control']);
      }

      logger.info('judgement-service request completed (STREAM)', {
        requestId: req.requestId,
        layer: 'JUDGEMENT_PROXY',
        method: 'GET',
        path,
        statusCode: response.status,
        durationMs: Date.now() - startedAt,
      });

      return response.data.pipe(res);
    } catch (error) {
      logger.error(`judgement-service stream request failed: ${error.message}`, {
        requestId: req.requestId,
        layer: 'JUDGEMENT_PROXY',
        method: 'GET',
        path,
        upstreamStatus: error.response?.status,
      });
      
      if (error.response && error.response.status === 404) {
        return res.status(404).send('PDF page artifact not found');
      }
      return next({
        statusCode: 502,
        code: 'JUDGEMENT_SERVICE_UNAVAILABLE',
        message: 'Judgement service is unavailable',
      });
    }
  });

  router.get('/:documentId', (req, res, next) =>
    forward(req, res, next, {
      method: 'GET',
      path: `/api/judgements/${req.params.documentId}`,
    })
  );

  router.post('/:documentId/reprocess', (req, res, next) =>
    forward(req, res, next, {
      method: 'POST',
      path: `/api/judgements/${req.params.documentId}/reprocess`,
    })
  );

  router.put('/:documentId/metadata', (req, res, next) =>
    forward(req, res, next, {
      method: 'PUT',
      path: `/api/judgements/${req.params.documentId}/metadata`,
      data: req.body,
    })
  );

  router.put('/:documentId/archive', (req, res, next) =>
    forward(req, res, next, {
      method: 'PUT',
      path: `/api/judgements/${req.params.documentId}/archive`,
    })
  );

  router.delete('/:documentId', (req, res, next) =>
    forward(req, res, next, {
      method: 'DELETE',
      path: `/api/judgements/${req.params.documentId}`,
    })
  );

  return router;
};
