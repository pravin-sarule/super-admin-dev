import { API_BASE_URL, getToken } from '../config';

const BASE = `${API_BASE_URL}/admin/chatbot-config`;

const authHeaders = () => {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const handle = async (res) => {
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

const chatbotConfigService = {
  getConfig: () => fetch(BASE, { headers: authHeaders() }).then(handle),
  updateConfig: (body) =>
    fetch(BASE, { method: 'PUT', headers: authHeaders(), body: JSON.stringify(body) }).then(handle),
};

export default chatbotConfigService;
