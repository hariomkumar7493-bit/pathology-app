// Use relative URL for production (same domain), localhost for development
// Capacitor on Android uses https://localhost, so detect native app context
const isCapacitor = window.location.protocol === 'capacitor:' || 
  (window.location.hostname === 'localhost' && window.location.port === '');
const isDev = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && !isCapacitor;

// Check if running in Electron with offline DB support
const isElectron = !!(window.electronAPI && window.electronAPI.db);

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

// HTTP request fallback (for web/mobile)
async function request(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const method = (options.method || 'GET').toUpperCase();
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

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

  if (method === 'POST' || method === 'PUT' || method === 'DELETE') {
    if (url.startsWith('/patients')) invalidateCache('/patients');
    if (url.startsWith('/reports')) invalidateCache('/reports');
    if (url.startsWith('/tests')) invalidateCache('/tests');
    if (url.startsWith('/settings')) invalidateCache('/settings');
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

// In Electron mode, trigger sync after mutations
function maybeSync() {
  if (isElectron && window.electronAPI.sync && getToken()) {
    window.electronAPI.sync.now(getToken()).catch(() => {});
  }
}

export const api = {
  // Auth
  login: async (phone, password) => {
    if (isElectron) {
      const response = await window.electronAPI.db.login({ phone, password });
      if (response.token) {
        setToken(response.token);
        if (window.electronAPI.sync) {
          window.electronAPI.sync.now(response.token).catch(() => {});
        }
      }
      return response;
    }
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
  getUsers: () => isElectron ? window.electronAPI.db.getUsers() : request('/auth/users'),
  createUser: (data) => isElectron ? window.electronAPI.db.createUser(data).then(r => { maybeSync(); return r; }) : request('/auth/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id, data) => isElectron ? window.electronAPI.db.updateUser({ id, ...data }).then(r => { maybeSync(); return r; }) : request(`/auth/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (id) => isElectron ? window.electronAPI.db.deleteUser({ id }).then(r => { maybeSync(); return r; }) : request(`/auth/users/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboard: () => isElectron ? window.electronAPI.db.getDashboard() : request('/dashboard'),

  // Patients
  getPatients: () => isElectron ? window.electronAPI.db.getPatients() : request('/patients'),
  getPatient: (id) => isElectron ? window.electronAPI.db.getPatient(id) : request(`/patients/${id}`),
  createPatient: (data) => isElectron ? window.electronAPI.db.createPatient(data).then(r => { maybeSync(); return r; }) : request('/patients', { method: 'POST', body: JSON.stringify(data) }),
  updatePatient: (id, data) => isElectron ? window.electronAPI.db.updatePatient(id, data).then(r => { maybeSync(); return r; }) : request(`/patients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePatient: (id) => isElectron ? window.electronAPI.db.deletePatient(id).then(r => { maybeSync(); return r; }) : request(`/patients/${id}`, { method: 'DELETE' }),
  searchPatients: (term) => isElectron ? window.electronAPI.db.searchPatients(term) : request(`/patients/search/${encodeURIComponent(term)}`),

  // Tests
  getTests: () => isElectron ? window.electronAPI.db.getTests() : request('/tests'),
  getCategories: () => isElectron ? window.electronAPI.db.getCategories() : request('/tests/categories'),
  getTestParameters: (id) => isElectron ? window.electronAPI.db.getTestParameters(id) : request(`/tests/${id}/parameters`),
  getBulkParameters: (testIds) => isElectron ? window.electronAPI.db.getBulkParameters(testIds) : request('/tests/parameters/bulk', { method: 'POST', body: JSON.stringify({ testIds }) }),
  createTest: (data) => isElectron ? window.electronAPI.db.createTest(data).then(r => { maybeSync(); return r; }) : request('/tests', { method: 'POST', body: JSON.stringify(data) }),
  updateTest: (id, data) => isElectron ? window.electronAPI.db.updateTest(id, data).then(r => { maybeSync(); return r; }) : request(`/tests/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteTest: (id) => isElectron ? window.electronAPI.db.deleteTest(id).then(r => { maybeSync(); return r; }) : request(`/tests/${id}`, { method: 'DELETE' }),
  createCategory: (data) => isElectron ? window.electronAPI.db.createCategory(data).then(r => { maybeSync(); return r; }) : request('/tests/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id, data) => isElectron ? window.electronAPI.db.updateCategory(id, data).then(r => { maybeSync(); return r; }) : request(`/tests/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id) => isElectron ? window.electronAPI.db.deleteCategory(id).then(r => { maybeSync(); return r; }) : request(`/tests/categories/${id}`, { method: 'DELETE' }),

  // Reports
  getReports: () => isElectron ? window.electronAPI.db.getReports() : request('/reports'),
  getReport: (id) => isElectron ? window.electronAPI.db.getReport(id) : request(`/reports/${id}`),
  createReport: (data) => isElectron ? window.electronAPI.db.createReport(data).then(r => { maybeSync(); return r; }) : request('/reports', { method: 'POST', body: JSON.stringify(data) }),
  updateReportResults: (id, data) => isElectron ? window.electronAPI.db.updateReportResults(id, data).then(r => { maybeSync(); return r; }) : request(`/reports/${id}/results`, { method: 'PUT', body: JSON.stringify(data) }),
  createQuickReport: (data) => isElectron ? window.electronAPI.db.createQuickReport(data).then(r => { maybeSync(); return r; }) : request('/reports/quick', { method: 'POST', body: JSON.stringify(data) }),
  deleteReport: (id) => isElectron ? window.electronAPI.db.deleteReport(id).then(r => { maybeSync(); return r; }) : request(`/reports/${id}`, { method: 'DELETE' }),
  addTestToReport: (reportId, testId) => isElectron ? window.electronAPI.db.addTestToReport(reportId, testId).then(r => { maybeSync(); return r; }) : request(`/reports/${reportId}/tests`, { method: 'POST', body: JSON.stringify({ test_id: testId }) }),
  removeTestFromReport: (reportId, testId) => isElectron ? window.electronAPI.db.removeTestFromReport(reportId, testId).then(r => { maybeSync(); return r; }) : request(`/reports/${reportId}/tests/${testId}`, { method: 'DELETE' }),

  // Report Layout Settings
  getReportLayout: () => isElectron ? window.electronAPI.db.getReportLayout() : request('/settings/report-layout'),
  updateReportLayout: (data) => isElectron ? window.electronAPI.db.updateReportLayout(data).then(r => { maybeSync(); return r; }) : request('/settings/report-layout', { method: 'PUT', body: JSON.stringify(data) }),
  resetReportLayout: () => isElectron ? window.electronAPI.db.resetReportLayout().then(r => { maybeSync(); return r; }) : request('/settings/report-layout/reset', { method: 'POST' }),

  // Referring Doctors
  getReferringDoctors: () => isElectron ? window.electronAPI.db.getReferringDoctors() : request('/settings/referring-doctors'),
  updateReferringDoctors: (doctors) => isElectron ? window.electronAPI.db.updateReferringDoctors(doctors).then(r => { maybeSync(); return r; }) : request('/settings/referring-doctors', { method: 'PUT', body: JSON.stringify({ doctors }) }),
};
