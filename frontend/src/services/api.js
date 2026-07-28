const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
let accessToken = null;
let unauthorizedHandler = null;
let refreshRequest = null;

export function setAccessToken(token) {
  accessToken = typeof token === 'string' && token ? token : null;
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
}

function buildUrl(path, query) {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });

  return API_BASE_URL ? `${url.pathname}${url.search}`.replace(/^/, API_BASE_URL) : `${url.pathname}${url.search}`;
}

async function readResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  return contentType.includes('application/json') ? response.json() : null;
}

async function requestRefreshToken() {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      const response = await fetch(buildUrl('/api/refresh'), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
      });
      const payload = await readResponse(response);

      if (!response.ok) {
        const error = new Error(
          payload?.error || `Request failed with status ${response.status}`
        );

        error.status = response.status;
        error.code = payload?.code;
        error.traceId = payload?.trace_id;
        throw error;
      }

      setAccessToken(payload?.token);
      return payload;
    })().finally(() => {
      refreshRequest = null;
    });
  }

  return refreshRequest;
}

export async function apiRequest(
  path,
  { method = 'GET', body, query, signal } = {},
  allowRefresh = true
) {
  const requestHadAccessToken = Boolean(accessToken);
  const headers = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const payload = await readResponse(response);

  if (!response.ok) {
    if (
      response.status === 401 &&
      requestHadAccessToken &&
      allowRefresh &&
      path !== '/api/refresh'
    ) {
      try {
        await requestRefreshToken();
        return apiRequest(
          path,
          { method, body, query, signal },
          false
        );
      } catch {
        setAccessToken(null);
        unauthorizedHandler?.();
      }
    }

    const message = payload?.error || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.code = payload?.code;
    error.traceId = payload?.trace_id;

    if (
      response.status === 401 &&
      requestHadAccessToken &&
      !allowRefresh
    ) {
      setAccessToken(null);
      unauthorizedHandler?.();
    }

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

export function refreshSession() {
  return requestRefreshToken();
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
