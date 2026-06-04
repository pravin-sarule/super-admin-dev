import { API_BASE_URL, getAuthHeaders } from '../../../config';

const BASE = `${API_BASE_URL}/admin/user-analytics`;

async function req(url) {
  const res = await fetch(url, { headers: getAuthHeaders() });
  let body = {};
  try { body = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new Error(body.message || body.error || `HTTP ${res.status}`);
  return body;
}

export const fetchUserAnalytics = (userId) => req(`${BASE}/users/${userId}/analytics`);
export const fetchUserStorage = (userId) => req(`${BASE}/users/${userId}/storage`);
export const fetchUserTokenSeries = (userId, days = 30) => req(`${BASE}/users/${userId}/token-usage?days=${days}`);
export const fetchUserAiUsage = (userId, days = 30) => req(`${BASE}/users/${userId}/ai-usage?days=${days}`);
export const fetchFirmAnalytics = (firmId) => req(`${BASE}/firms/${firmId}/analytics`);

const PBASE = `${API_BASE_URL}/admin/plan-analytics`;
export const fetchPlanSummary = () => req(`${PBASE}/summary`);
export const fetchMonthlySubscribers = (planId) => req(`${PBASE}/monthly/${planId}/subscribers`);
export const fetchTopupBuyers = (planId) => req(`${PBASE}/topup/${planId}/buyers`);
