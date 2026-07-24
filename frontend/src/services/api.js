const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function buildUrl(path, query) {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return API_BASE_URL ? `${url.pathname}${url.search}`.replace(/^/, API_BASE_URL) : `${url.pathname}${url.search}`;
}

export async function apiRequest(path, { method = 'GET', body, query, signal } = {}) {
  const headers = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    credentials: 'include',
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
    body: { email, password },
  });
}

export function logout() {
  return apiRequest('/api/logout', {
    method: 'POST',
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
