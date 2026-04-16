import axios from 'axios';
import { BACKEND_ORIGIN, getToken } from '../config';

const SEARCH_API_BASE_URL = `${BACKEND_ORIGIN}/api/judgements-admin/search`;

function authHeaders() {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  };
}

async function request(label, config) {
  try {
    console.debug(`[JudgementSearchApi] ${label} request started`, {
      method: config.method || 'GET',
      url: config.url,
      params: config.params || null,
      hasToken: Boolean(getToken()),
    });

    const response = await axios(config);

    console.debug(`[JudgementSearchApi] ${label} request succeeded`, {
      method: config.method || 'GET',
      url: config.url,
      status: response.status,
      requestId: response.headers?.['x-request-id'] || null,
    });

    return response.data;
  } catch (error) {
    console.error(`[JudgementSearchApi] ${label} request failed`, {
      method: config.method || 'GET',
      url: config.url,
      status: error.response?.status || null,
      message: error.message || null,
      responseData: error.response?.data || null,
    });
    throw error;
  }
}

class JudgementSearchApi {
  async hybrid(payload) {
    return request('hybrid', {
      method: 'POST',
      url: `${SEARCH_API_BASE_URL}/hybrid`,
      data: payload,
      headers: authHeaders(),
    });
  }

  async analytics(params = {}) {
    return request('analytics', {
      method: 'GET',
      url: `${SEARCH_API_BASE_URL}/analytics`,
      params,
      headers: authHeaders(),
    });
  }
}

export default new JudgementSearchApi();
