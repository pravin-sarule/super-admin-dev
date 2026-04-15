import axios from 'axios';

// Defaults: Cloud Run super-admin backend & template analyzer. Override with VITE_* in .env for local dev.
const DEFAULT_API_BASE = 'https://super-admin-backend-120280829617.asia-south1.run.app/api';
const DEFAULT_JUDGEMENT_SERVICE_ORIGIN = 'https://judgement-service-120280829617.asia-south1.run.app';

/** All dashboard routes are mounted under `/api/...` on the backend. Accept env with or without `/api`. */
function normalizeApiBaseUrl(raw) {
  const base = String(raw ?? '').trim();
  if (!base) return DEFAULT_API_BASE;
  const noTrailingSlashes = base.replace(/\/+$/, '');
  return noTrailingSlashes.endsWith('/api') ? noTrailingSlashes : `${noTrailingSlashes}/api`;
}

function normalizeOriginUrl(raw, fallback) {
  const base = String(raw ?? '').trim();
  if (!base) return fallback;
  return base.replace(/\/+$/, '');
}

const API_BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
    ? normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL)
    : DEFAULT_API_BASE;

/** Backend origin without `/api` (document gateway, etc.) */
export const BACKEND_ORIGIN = String(API_BASE_URL).replace(/\/api\/?$/, '');

/** Direct judgement-service origin for proxy fallback. Accepts env with or without path. */
export const JUDGEMENT_SERVICE_ORIGIN = normalizeOriginUrl(
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_JUDGEMENT_SERVICE_URL
    ? String(import.meta.env.VITE_JUDGEMENT_SERVICE_URL).replace(/\/api\/judgements\/?$/, '').replace(/\/api\/?$/, '')
    : '',
  DEFAULT_JUDGEMENT_SERVICE_ORIGIN
);

/** Template Analyzer Agent (Cloud Run) */
export const TEMPLATE_ANALYZER_BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_TEMPLATE_ANALYZER_BASE_URL
    ? import.meta.env.VITE_TEMPLATE_ANALYZER_BASE_URL
    : 'https://template-analyzer-agent-120280829617.asia-south1.run.app';

/** Analyzer routes are mounted under `/analysis` */
export const ANALYSIS_API_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_ANALYSIS_API_URL
    ? import.meta.env.VITE_ANALYSIS_API_URL
    : `${TEMPLATE_ANALYZER_BASE_URL}/analysis`;

const ADMIN_CREATE_URL = `${API_BASE_URL}/admins/create`;
const ADMIN_GET_ALL_URL = `${API_BASE_URL}/admins`;
const ADMIN_GET_BY_ID_URL = `${API_BASE_URL}/admins`; // For GET, PUT, DELETE by ID

// Shared auth for all dashboard API calls to main backend (same as Prompt Management / Template Management pattern)
const getToken = () => {
  const t = localStorage.getItem('token') || sessionStorage.getItem('token');
  return t ? String(t).trim() : null;
};

const getAuthHeaders = () => {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  };
};

// On 401 (Invalid token / Unauthorized), clear token and force re-login so backend and frontend stay in sync
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export { API_BASE_URL, ADMIN_CREATE_URL, ADMIN_GET_ALL_URL, ADMIN_GET_BY_ID_URL, getToken, getAuthHeaders };
