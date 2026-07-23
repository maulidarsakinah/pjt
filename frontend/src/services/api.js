const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const TOKEN_KEY = 'pkl_api_token';
const USER_KEY = 'pkl_api_user';

function buildUrl(path, query) {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return API_BASE_URL ? `${url.pathname}${url.search}`.replace(/^/, API_BASE_URL) : `${url.pathname}${url.search}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const value = localStorage.getItem(USER_KEY);

  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export function setSession({ token, user }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export async function apiRequest(path, { method = 'GET', body, query, auth = true, signal } = {}) {
  const headers = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const token = getToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    const message = payload?.error || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.code = payload?.code;
    error.traceId = payload?.trace_id;
    throw error;
  }

  return payload;
}

export function login(email, password) {
  return apiRequest('/api/login', {
    method: 'POST',
    auth: false,
    body: { email, password },
  });
}

export function getMe() {
  return apiRequest('/api/me');
}

export function changePassword(currentPassword, newPassword, newPasswordConfirmation) {
  return apiRequest('/api/me/password', {
    method: 'PATCH',
    body: {
      current_password: currentPassword,
      new_password: newPassword,
      new_password_confirmation: newPasswordConfirmation,
    },
  });
}

export function getFlowStations(query) {
  return apiRequest('/api/stations/flow', { query });
}

export function getFlowStationData(id, query) {
  return apiRequest(`/api/stations/flow/${id}/data`, { query });
}

export function getCompany(id) {
  return apiRequest(`/api/companies/${id}`);
}

export function getAuditLogs(query, { signal } = {}) {
  return apiRequest('/api/logs', { query, signal });
}
