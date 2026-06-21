// Use relative URL for production (same domain), localhost for development
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `http://${window.location.hostname}:5000/api`
  : '/api';

// Token management
const getToken = () => localStorage.getItem('token');
const setToken = (token) => localStorage.setItem('token', token);
const removeToken = () => localStorage.removeItem('token');

async function request(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  
  // Add Authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
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
  login: async (email, password) => {
    const response = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    if (response.token) {
      setToken(response.token);
    }
    return response;
  },
  register: async (name, email, password) => {
    const response = await request('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
    if (response.token) {
      setToken(response.token);
    }
    return response;
  },
  logout: () => {
    removeToken();
    return Promise.resolve();
  },

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
};
