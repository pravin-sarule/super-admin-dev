const API_BASE_URL = 'http://localhost:4000/api';

const ADMIN_CREATE_URL = `${API_BASE_URL}/admins/create`;
const ADMIN_GET_ALL_URL = `${API_BASE_URL}/admins`;
const ADMIN_GET_BY_ID_URL = `${API_BASE_URL}/admins`; // For GET, PUT, DELETE by ID

export { API_BASE_URL, ADMIN_CREATE_URL, ADMIN_GET_ALL_URL, ADMIN_GET_BY_ID_URL };