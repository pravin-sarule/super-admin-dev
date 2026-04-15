import axios from 'axios';
import { BACKEND_ORIGIN, getToken } from '../config';

const API_BASE_URL = `${BACKEND_ORIGIN}/api/judgements-admin`;

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

class JudgementAdminApi {
  async list(params = {}) {
    const response = await axios.get(API_BASE_URL, {
      params,
      headers: authHeaders(),
    });
    return response.data;
  }

  async summary() {
    const response = await axios.get(`${API_BASE_URL}/summary`, {
      headers: authHeaders(),
    });
    return response.data;
  }

  async dependencyHealth() {
    const response = await axios.get(`${API_BASE_URL}/dependencies/health`, {
      headers: authHeaders(),
    });
    return response.data;
  }

  async upload({ files, sourceUrl }) {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('documents', file);
    });
    if (sourceUrl) {
      formData.append('source_url', sourceUrl);
    }

    const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
      headers: authHeaders(),
    });
    return response.data;
  }

  async detail(documentId) {
    const response = await axios.get(`${API_BASE_URL}/${documentId}`, {
      headers: authHeaders(),
    });
    return response.data;
  }

  async status(documentId) {
    const response = await axios.get(`${API_BASE_URL}/${documentId}/status`, {
      headers: authHeaders(),
    });
    return response.data;
  }

  async getPagePdfBlob(documentId, pageNumber) {
    const response = await axios.get(`${API_BASE_URL}/${documentId}/pages/${pageNumber}/pdf`, {
      headers: authHeaders(),
      responseType: 'blob',
    });
    return response.data;
  }

  async getPageOcrLayout(documentId, pageNumber) {
    const response = await axios.get(`${API_BASE_URL}/${documentId}/pages/${pageNumber}/ocr-layout`, {
      headers: authHeaders(),
    });
    return response.data;
  }

  async vectors(documentId, pointIds = []) {
    const response = await axios.get(`${API_BASE_URL}/${documentId}/vectors`, {
      headers: authHeaders(),
      params: {
        pointIds: pointIds.join(','),
      },
    });
    return response.data;
  }

  async reprocess(documentId) {
    const response = await axios.post(`${API_BASE_URL}/${documentId}/reprocess`, {}, {
      headers: authHeaders(),
    });
    return response.data;
  }

  async reprocessFailed() {
    const response = await axios.post(`${API_BASE_URL}/reprocess-failed`, {}, {
      headers: authHeaders(),
    });
    return response.data;
  }

  async updateMetadata(documentId, payload) {
    const response = await axios.put(`${API_BASE_URL}/${documentId}/metadata`, payload, {
      headers: authHeaders({
        'Content-Type': 'application/json',
      }),
    });
    return response.data;
  }

  async archiveJudgment(documentId) {
    const response = await axios.put(`${API_BASE_URL}/${documentId}/archive`, {}, {
      headers: authHeaders(),
    });
    return response.data;
  }

  async deleteJudgment(documentId) {
    const response = await axios.delete(`${API_BASE_URL}/${documentId}`, {
      headers: authHeaders(),
    });
    return response.data;
  }
}

export default new JudgementAdminApi();
