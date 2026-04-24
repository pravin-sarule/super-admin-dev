import axios from 'axios';
import { BACKEND_ORIGIN, JUDGEMENT_SERVICE_ORIGIN, getToken } from '../config';

const PROXY_API_BASE_URL = `${BACKEND_ORIGIN}/api/judgements-admin`;
const DIRECT_API_BASE_URL = `${JUDGEMENT_SERVICE_ORIGIN}/api/judgements`;

function getNowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

function getDurationMs(startedAt) {
  return Math.round(getNowMs() - startedAt);
}

function normalizeHeaders(headers) {
  if (!headers) return {};
  if (typeof headers.toJSON === 'function') return headers.toJSON();

  try {
    return { ...headers };
  } catch (_) {
    return {};
  }
}

function getRequestId(headers) {
  const normalized = normalizeHeaders(headers);
  return normalized['x-request-id'] || normalized['X-Request-Id'] || null;
}

function summarizePayload(data) {
  if (data == null) return null;

  if (typeof Blob !== 'undefined' && data instanceof Blob) {
    return {
      type: 'blob',
      mimeType: data.type || null,
      size: data.size,
    };
  }

  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    return {
      type: 'form-data',
      keys: Array.from(data.keys()),
    };
  }

  if (typeof data === 'string') {
    return data.length > 500 ? `${data.slice(0, 500)}...` : data;
  }

  return data;
}

function buildDirectUrl(url) {
  if (!url) return DIRECT_API_BASE_URL;
  if (String(url).startsWith(PROXY_API_BASE_URL)) {
    return String(url).replace(PROXY_API_BASE_URL, DIRECT_API_BASE_URL);
  }
  return url;
}

function shouldRetryDirect(error, transport) {
  if (transport === 'direct') return false;

  if (!JUDGEMENT_SERVICE_ORIGIN) return false;

  if (!error.response) return true;

  return Number(error.response.status) >= 500;
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function performRequest(label, config) {
  const startedAt = getNowMs();
  const method = String(config.method || 'GET').toUpperCase();
  const tokenPresent = Boolean(getToken());
  const transport = config._judgementTransport || 'proxy';
  const effectiveUrl = transport === 'direct' ? buildDirectUrl(config.url) : config.url;
  const requestConfig = {
    ...config,
    url: effectiveUrl,
  };

  console.debug(`[JudgementAdminApi] ${label} request started`, {
    label,
    method,
    transport,
    url: effectiveUrl,
    backendOrigin: BACKEND_ORIGIN,
    judgementServiceOrigin: JUDGEMENT_SERVICE_ORIGIN,
    params: requestConfig.params || null,
    responseType: requestConfig.responseType || 'json',
    tokenPresent,
  });

  try {
    const response = await axios(requestConfig);

    console.debug(`[JudgementAdminApi] ${label} request succeeded`, {
      label,
      method,
      transport,
      url: effectiveUrl,
      status: response.status,
      durationMs: getDurationMs(startedAt),
      requestId: getRequestId(response.headers),
      responseHeaders: normalizeHeaders(response.headers),
      responsePreview:
        requestConfig.responseType === 'blob' ? summarizePayload(response.data) : undefined,
    });

    return response.data;
  } catch (error) {
    const responseHeaders = normalizeHeaders(error.response?.headers);

    console.groupCollapsed(`[JudgementAdminApi] ${label} request failed`);
    console.error('Failure summary', {
      label,
      method,
      transport,
      url: effectiveUrl,
      backendOrigin: BACKEND_ORIGIN,
      judgementServiceOrigin: JUDGEMENT_SERVICE_ORIGIN,
      params: requestConfig.params || null,
      durationMs: getDurationMs(startedAt),
      tokenPresent,
      code: error.code || null,
      message: error.message || null,
      status: error.response?.status || null,
      statusText: error.response?.statusText || null,
      requestId: getRequestId(responseHeaders),
      responseUrl: error.request?.responseURL || null,
    });
    console.error('Response payload', summarizePayload(error.response?.data));
    console.error('Response headers', responseHeaders);
    console.error('Axios config', {
      method: error.config?.method || method,
      url: error.config?.url || effectiveUrl,
      baseURL: error.config?.baseURL || null,
      params: error.config?.params || requestConfig.params || null,
      timeout: error.config?.timeout ?? null,
    });
    console.groupEnd();

    if (shouldRetryDirect(error, transport)) {
      console.warn(`[JudgementAdminApi] ${label} retrying direct judgement-service request`, {
        label,
        failedTransport: transport,
        retryTransport: 'direct',
        proxyUrl: effectiveUrl,
        directUrl: buildDirectUrl(config.url),
        status: error.response?.status || null,
        code: error.code || null,
      });

      return performRequest(label, {
        ...config,
        _judgementTransport: 'direct',
      });
    }

    throw error;
  }
}

class JudgementAdminApi {
  async list(params = {}) {
    return performRequest('list', {
      method: 'GET',
      url: PROXY_API_BASE_URL,
      params,
      headers: authHeaders(),
    });
  }

  async summary() {
    return performRequest('summary', {
      method: 'GET',
      url: `${PROXY_API_BASE_URL}/summary`,
      headers: authHeaders(),
    });
  }

  async dependencyHealth() {
    return performRequest('dependencyHealth', {
      method: 'GET',
      url: `${PROXY_API_BASE_URL}/dependencies/health`,
      headers: authHeaders(),
    });
  }

  async pipelineReportSummary(params = {}) {
    return performRequest('pipelineReportSummary', {
      method: 'GET',
      url: `${PROXY_API_BASE_URL}/pipeline-report/summary`,
      params,
      headers: authHeaders(),
    });
  }

  async pipelineReportList(params = {}) {
    return performRequest('pipelineReportList', {
      method: 'GET',
      url: `${PROXY_API_BASE_URL}/pipeline-report`,
      params,
      headers: authHeaders(),
    });
  }

  async pipelineReportDetail(judgmentUuid) {
    return performRequest('pipelineReportDetail', {
      method: 'GET',
      url: `${PROXY_API_BASE_URL}/pipeline-report/${judgmentUuid}`,
      headers: authHeaders(),
    });
  }

  async pipelineReportVectors(judgmentUuid, pointIds = []) {
    return performRequest('pipelineReportVectors', {
      method: 'GET',
      url: `${PROXY_API_BASE_URL}/pipeline-report/${judgmentUuid}/vectors`,
      headers: authHeaders(),
      params: {
        pointIds: pointIds.join(','),
      },
    });
  }

  async upload({ files, sourceUrl }) {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('documents', file);
    });
    if (sourceUrl) {
      formData.append('source_url', sourceUrl);
    }

    return performRequest('upload', {
      method: 'POST',
      url: `${PROXY_API_BASE_URL}/upload`,
      data: formData,
      headers: authHeaders(),
    });
  }

  async detail(documentId) {
    return performRequest('detail', {
      method: 'GET',
      url: `${PROXY_API_BASE_URL}/${documentId}`,
      headers: authHeaders(),
    });
  }

  async status(documentId) {
    return performRequest('status', {
      method: 'GET',
      url: `${PROXY_API_BASE_URL}/${documentId}/status`,
      headers: authHeaders(),
    });
  }

  async getPagePdfBlob(documentId, pageNumber) {
    return performRequest('getPagePdfBlob', {
      method: 'GET',
      url: `${PROXY_API_BASE_URL}/${documentId}/pages/${pageNumber}/pdf`,
      headers: authHeaders(),
      responseType: 'blob',
    });
  }

  async getPageOcrLayout(documentId, pageNumber) {
    return performRequest('getPageOcrLayout', {
      method: 'GET',
      url: `${PROXY_API_BASE_URL}/${documentId}/pages/${pageNumber}/ocr-layout`,
      headers: authHeaders(),
    });
  }

  async vectors(documentId, pointIds = []) {
    return performRequest('vectors', {
      method: 'GET',
      url: `${PROXY_API_BASE_URL}/${documentId}/vectors`,
      headers: authHeaders(),
      params: {
        pointIds: pointIds.join(','),
      },
    });
  }

  async reprocess(documentId) {
    return performRequest('reprocess', {
      method: 'POST',
      url: `${PROXY_API_BASE_URL}/${documentId}/reprocess`,
      data: {},
      headers: authHeaders(),
    });
  }

  async reprocessFailed() {
    return performRequest('reprocessFailed', {
      method: 'POST',
      url: `${PROXY_API_BASE_URL}/reprocess-failed`,
      data: {},
      headers: authHeaders(),
    });
  }

  async updateMetadata(documentId, payload) {
    return performRequest('updateMetadata', {
      method: 'PUT',
      url: `${PROXY_API_BASE_URL}/${documentId}/metadata`,
      data: payload,
      headers: authHeaders({
        'Content-Type': 'application/json',
      }),
    });
  }

  async archiveJudgment(documentId) {
    return performRequest('archiveJudgment', {
      method: 'PUT',
      url: `${PROXY_API_BASE_URL}/${documentId}/archive`,
      data: {},
      headers: authHeaders(),
    });
  }

  async deleteJudgment(documentId) {
    return performRequest('deleteJudgment', {
      method: 'DELETE',
      url: `${PROXY_API_BASE_URL}/${documentId}`,
      headers: authHeaders(),
    });
  }
}

export default new JudgementAdminApi();
