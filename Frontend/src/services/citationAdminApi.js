/**
 * Citation Admin Dashboard API — /api/citation-admin/* endpoints.
 * Auth: same as rest of dashboard (Bearer JWT from getAuthHeaders).
 */
import axios from 'axios';
import { API_BASE_URL, getAuthHeaders } from '../config';

const isLocalFrontend =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

/**
 * Local dev: use relative `/api` so Vite proxies to the backend.
 * Avoids 404s from Cloud Run when it is behind on citation-admin/analytics routes.
 * Preview / prod build on localhost without Vite: use configured API_BASE_URL.
 */
const effectiveApiBase =
  isLocalFrontend && import.meta.env.DEV
    ? '/api'
    : API_BASE_URL;

const ADMIN_BASE = `${effectiveApiBase.replace(/\/$/, '')}/citation-admin`;

const request = (method, path, data = null, params = null) => {
  const config = {
    method,
    url: `${ADMIN_BASE}${path}`,
    headers: getAuthHeaders(),
    ...(params && { params }),
    ...(data && { data }),
  };
  return axios(config).then((res) => res.data);
};

// --- Overview ---
export const getOverview = () => request('GET', '/overview');

// --- HITL ---
export const getHitlList = (params = {}) =>
  request('GET', '/hitl', null, {
    status: params.status,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
    sort: params.sort || 'priority_desc',
  });
export const getHitlTask = (taskId) =>
  request('GET', `/hitl/${encodeURIComponent(taskId)}`);
export const postHitlAction = (taskId, body) =>
  request('POST', `/hitl/${encodeURIComponent(taskId)}/action`, body);

// --- Pipeline ---
export const getPipelineSummary = () => request('GET', '/pipeline/summary');
export const getPipelineItems = (params = {}) =>
  request('GET', '/pipeline/items', null, {
    status: params.status,
    source: params.source,
    startDate: params.startDate,
    endDate: params.endDate,
    hasError: params.hasError,
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
  });
export const getPipelineErrors = (limit = 50) =>
  request('GET', '/pipeline/errors', null, { limit });

// --- Pipeline Agents (dynamic) ---
export const getPipelineAgents = (params = {}) =>
  request('GET', '/pipeline/agents', null, {
    windowMinutes: params.windowMinutes ?? 5,
    uptimeWindowHours: params.uptimeWindowHours ?? 24,
  });
export const getPipelineAgentHealth = (agentName, params = {}) =>
  request('GET', `/pipeline/agents/${encodeURIComponent(agentName)}/health`, null, {
    logLimit: params.logLimit ?? 10,
    uptimeWindowHours: params.uptimeWindowHours ?? 24,
  });
export const getPipelineThroughput = (params = {}) =>
  request('GET', '/pipeline/throughput', null, {
    bucket: params.bucket ?? 'hour',
    ...(params.date && { date: params.date }),
  });
export const getPipelineRuns = (params = {}) =>
  request('GET', '/pipeline/runs', null, {
    ...(params.status && { status: params.status }),
    page: params.page ?? 1,
    pageSize: params.pageSize ?? 20,
  });
export const getPipelineRunLogs = (runId) =>
  request('GET', `/pipeline/runs/${encodeURIComponent(runId)}/logs`);

// --- Routes & DB ---
export const getRoutesDbSummary = () => request('GET', '/routesdb/summary');
export const getRoutesDbTopCited = (limit = 20) =>
  request('GET', '/routesdb/top-cited', null, { limit });
export const getRoutesDbCourtsBreakdown = () =>
  request('GET', '/routesdb/courts-breakdown');

// --- Analytics (citation_service_usage) ---
export const getAnalytics = () => request('GET', '/analytics');
export const getAnalyticsHeartbeat = () => request('GET', '/analytics/heartbeat');
export const getAnalyticsUserDetails = (userId) =>
  request('GET', `/analytics/user/${encodeURIComponent(userId)}`);

// --- Business ---
export const getBusinessSummary = () => request('GET', '/business/summary');
export const getBusinessReportsPerDay = (days = 30) =>
  request('GET', '/business/reports-per-day', null, { days });
export const getBusinessTopUsers = (limit = 20) =>
  request('GET', '/business/top-users', null, { limit });