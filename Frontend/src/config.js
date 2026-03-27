import axios from 'axios';

// Cloud Run defaults; override with VITE_API_BASE_URL / VITE_BACKEND_ORIGIN / VITE_ANALYSIS_API_URL for local dev
const DEFAULT_BACKEND_ORIGIN = 'https://super-admin-backend-120280829617.asia-south1.run.app';
const DEFAULT_ANALYSIS_API_BASE = 'https://template-analyzer-agent-120280829617.asia-south1.run.app/analysis';

const envApiBase =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
    ? import.meta.env.VITE_API_BASE_URL
    : null;

// Use env in production so all pages (Admin, User, etc.) hit the same backend and token works
const API_BASE_URL = envApiBase || `${DEFAULT_BACKEND_ORIGIN}/api`;

export const BACKEND_ORIGIN =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_ORIGIN
    ? import.meta.env.VITE_BACKEND_ORIGIN
    : envApiBase
      ? String(envApiBase).replace(/\/api\/?$/, '')
      : DEFAULT_BACKEND_ORIGIN;

export const ANALYSIS_API_BASE_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_ANALYSIS_API_URL
    ? import.meta.env.VITE_ANALYSIS_API_URL
    : DEFAULT_ANALYSIS_API_BASE;

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

export {
  API_BASE_URL,
  ADMIN_CREATE_URL,
  ADMIN_GET_ALL_URL,
  ADMIN_GET_BY_ID_URL,
  getToken,
  getAuthHeaders,
};