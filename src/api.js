// Use relative URL for production (same domain), localhost for development
// Capacitor on Android uses https://localhost, so detect native app context
const isCapacitor = window.location.protocol === 'capacitor:' || 
  (window.location.hostname === 'localhost' && window.location.port === '');
const isDev = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && !isCapacitor;

const API_BASE = isDev
  ? `http://${window.location.hostname}:5000/api`
  : isCapacitor
    ? 'https://patholabpro.online/api'
    : '/api';

// Token management
const getToken = () => localStorage.getItem('token');
const setToken = (token) => localStorage.setItem('token', token);
const removeToken = () => localStorage.removeItem('token');

// Simple in-memory cache for GET requests
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds

function invalidateCache(prefix) {
  for (const key of cache.keys()) {
    if (!prefix || key.startsWith(prefix)) cache.delete(key);
  }
}

async function request(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const method = (options.method || 'GET').toUpperCase();
  
  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Cache GET requests
  if (method === 'GET') {
    const cacheKey = url;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.time < CACHE_TTL) {
      return cached.data;
    }

    const res = await fetch(`${API_BASE}${url}`, { headers, ...options });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error || 'Request failed');
    }
    const data = await res.json();
    cache.set(cacheKey, { data, time: Date.now() });
    return data;
  }

  // Non-GET requests invalidate relevant cache
  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    if (url.startsWith('/patients')) invalidateCache('/patients');
    if (url.startsWith('/reports')) invalidateCache('/reports');
    if (url.startsWith('/tests')) invalidateCache('/tests');
    if (url.startsWith('/settings')) invalidateCache('/settings');
    // Dashboard depends on everything
    cache.delete('/dashboard');
  }
  
  const res = await fetch(`${API_BASE}${url}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  // Auth
  login: async (phone, password) => {
    const response = await request('/auth/login', { method: 'POST', body: JSON.stringify({ phone, password }) });
    if (response.token) {
      setToken(response.token);
    }
    return response;
  },
  logout: () => {
    removeToken();
    return Promise.resolve();
  },

  // Staff Management (admin-only)
  getUsers: () => request('/auth/users'),
  createUser: (data) => request('/auth/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id) => request(`/auth/users/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboard: () => request('/dashboard'),

  // Patients
  getPatients: () => request('/patients'),
  getPatient: (id) => request(`/patients/${id}`),
  createPatient: (data) => request('/patients', { method: 'POST', body: JSON.stringify(data) }),
  updatePatient: (id, data) => request(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePatient: (id) => request(`/patients/${id}`, { method: 'DELETE' }),
  searchPatients: (term) => request(`/patients/search/${encodeURIComponent(term)}`),

  // Tests
  getTests: () => request('/tests'),
  getCategories: () => request('/tests/categories'),
  getTestParameters: (id) => request(`/tests/${id}/parameters`),
  getBulkParameters: (testIds) => request('/tests/parameters/bulk', { method: 'POST', body: JSON.stringify({ testIds }) }),
  createTest: (data) => request('/tests', { method: 'POST', body: JSON.stringify(data) }),
  updateTest: (id, data) => request(`/tests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTest: (id) => request(`/tests/${id}`, { method: 'DELETE' }),
  createCategory: (data) => request('/tests/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id, data) => request(`/tests/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id) => request(`/tests/categories/${id}`, { method: 'DELETE' }),

  // Reports
  getReports: () => request('/reports'),
  getReport: (id) => request(`/reports/${id}`),
  createReport: (data) => request('/reports', { method: 'POST', body: JSON.stringify(data) }),
  updateReportResults: (id, data) => request(`/reports/${id}/results`, { method: 'PUT', body: JSON.stringify(data) }),
  createQuickReport: (data) => request('/reports/quick', { method: 'POST', body: JSON.stringify(data) }),
  deleteReport: (id) => request(`/reports/${id}`, { method: 'DELETE' }),
  addTestToReport: (reportId, testId) => request(`/reports/${reportId}/tests`, { method: 'POST', body: JSON.stringify({ test_id: testId }) }),
  removeTestFromReport: (reportId, testId) => request(`/reports/${reportId}/tests/${testId}`, { method: 'DELETE' }),

  // Report Layout Settings
  getReportLayout: () => request('/settings/report-layout'),
  updateReportLayout: (data) => request('/settings/report-layout', { method: 'PUT', body: JSON.stringify(data) }),
  resetReportLayout: () => request('/settings/report-layout/reset', { method: 'POST' }),

  // Referring Doctors
  getReferringDoctors: () => request('/settings/referring-doctors'),
  updateReferringDoctors: (doctors) => request('/settings/referring-doctors', { method: 'PUT', body: JSON.stringify({ doctors }) }),
};
