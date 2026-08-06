const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);
let accessToken = null;
let unauthorizedHandler = null;
let refreshRequest = null;
const readRequestCache = new Map();
const READ_CACHE_TTL_MS = 30_000;
const READ_CACHE_MAX_ITEMS = 100;

function clearReadRequestCache() {
  readRequestCache.clear();
}

export function setAccessToken(token) {
  const nextAccessToken = typeof token === "string" && token ? token : null;

  if (nextAccessToken !== accessToken) {
    clearReadRequestCache();
  }

  accessToken = nextAccessToken;
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === "function" ? handler : null;
}

function buildUrl(path, query) {
  const url = new URL(`${API_BASE_URL}${path}`, window.location.origin);

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, value);
    }
  });

  return API_BASE_URL
    ? `${url.pathname}${url.search}`.replace(/^/, API_BASE_URL)
    : `${url.pathname}${url.search}`;
}

async function readResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  return contentType.includes("application/json") ? response.json() : null;
}

function createAbortError() {
  return new DOMException("The request was aborted.", "AbortError");
}

function subscribeToCachedRequest(entry, signal) {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    const consumer = Symbol("read-request-consumer");
    let isSettled = false;

    if (entry.status === "pending") {
      entry.consumers.add(consumer);
    }

    const cleanup = () => {
      signal?.removeEventListener("abort", handleAbort);
      entry.consumers.delete(consumer);
    };
    const handleAbort = () => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      cleanup();

      if (entry.status === "pending" && entry.consumers.size === 0) {
        if (readRequestCache.get(entry.cacheKey) === entry) {
          readRequestCache.delete(entry.cacheKey);
        }

        entry.controller.abort();
      }

      reject(createAbortError());
    };

    signal?.addEventListener("abort", handleAbort, { once: true });
    entry.promise.then(
      (value) => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          resolve(value);
        }
      },
      (error) => {
        if (!isSettled) {
          isSettled = true;
          cleanup();
          reject(error);
        }
      },
    );
  });
}

function cachedGet(path, query, { signal, ttlMs = READ_CACHE_TTL_MS } = {}) {
  const cacheKey = buildUrl(path, query);
  const now = Date.now();
  let entry = readRequestCache.get(cacheKey);

  if (entry?.status === "fulfilled" && entry.expiresAt <= now) {
    readRequestCache.delete(cacheKey);
    entry = null;
  }

  if (!entry) {
    for (const [key, cachedEntry] of readRequestCache) {
      if (cachedEntry.status === "fulfilled" && cachedEntry.expiresAt <= now) {
        readRequestCache.delete(key);
      }
    }

    while (readRequestCache.size >= READ_CACHE_MAX_ITEMS) {
      const oldestFulfilledKey = Array.from(readRequestCache.entries()).find(
        ([, cachedEntry]) => cachedEntry.status === "fulfilled",
      )?.[0];

      if (!oldestFulfilledKey) {
        break;
      }

      readRequestCache.delete(oldestFulfilledKey);
    }

    const controller = new AbortController();

    entry = {
      cacheKey,
      consumers: new Set(),
      controller,
      expiresAt: 0,
      promise: null,
      status: "pending",
    };
    entry.promise = apiRequest(path, {
      query,
      signal: controller.signal,
    }).then(
      (value) => {
        entry.status = "fulfilled";
        entry.expiresAt = Date.now() + ttlMs;
        return value;
      },
      (error) => {
        if (readRequestCache.get(cacheKey) === entry) {
          readRequestCache.delete(cacheKey);
        }

        throw error;
      },
    );
    readRequestCache.set(cacheKey, entry);
  }

  return subscribeToCachedRequest(entry, signal);
}

async function requestRefreshToken() {
  if (!refreshRequest) {
    refreshRequest = (async () => {
      const response = await fetch(buildUrl("/api/refresh"), {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        credentials: "include",
      });
      const payload = await readResponse(response);

      if (!response.ok) {
        const error = new Error(
          payload?.error || `Request failed with status ${response.status}`,
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
  { method = "GET", body, query, signal } = {},
  allowRefresh = true,
) {
  const requestHadAccessToken = Boolean(accessToken);
  const headers = {
    Accept: "application/json",
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });
  const payload = await readResponse(response);

  if (!response.ok) {
    if (
      response.status === 401 &&
      requestHadAccessToken &&
      allowRefresh &&
      path !== "/api/refresh"
    ) {
      try {
        await requestRefreshToken();
        return apiRequest(path, { method, body, query, signal }, false);
      } catch {
        setAccessToken(null);
        unauthorizedHandler?.();
      }
    }

    const message =
      payload?.error || `Request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.code = payload?.code;
    error.traceId = payload?.trace_id;

    if (response.status === 401 && requestHadAccessToken && !allowRefresh) {
      setAccessToken(null);
      unauthorizedHandler?.();
    }

    throw error;
  }

  return payload;
}

export function login(email, password) {
  return apiRequest("/api/login", {
    method: "POST",
    body: { email, password },
  });
}

export function logout() {
  return apiRequest("/api/logout", {
    method: "POST",
  });
}

export function refreshSession() {
  return requestRefreshToken();
}

export function getMe() {
  return apiRequest("/api/me");
}

export function changePassword(
  currentPassword,
  newPassword,
  newPasswordConfirmation,
) {
  return apiRequest("/api/me/password", {
    method: "PATCH",
    body: {
      current_password: currentPassword,
      new_password: newPassword,
      new_password_confirmation: newPasswordConfirmation,
    },
  });
}

export function getFlowStations(query, options) {
  return cachedGet("/api/stations/flow", query, options);
}

export function getMasterStations(query, options) {
  return cachedGet("/api/stations/master", query, options);
}

export function createMasterStation(body) {
  return apiRequest("/api/stations/master", { method: "POST", body });
}

export function getFlowStationData(id, query, options) {
  return cachedGet(`/api/stations/flow/${id}/data`, query, options);
}

export function prefetchFlowStationData(id, query) {
  return getFlowStationData(id, query);
}

export function getCompany(id) {
  return apiRequest(`/api/companies/${id}`);
}

export function getAuditLogs(query, { signal } = {}) {
  return apiRequest("/api/logs", { query, signal });
}

export function getAuditLogJourney(traceId, { signal } = {}) {
  return apiRequest(`/api/logs/journey/${encodeURIComponent(traceId)}`, {
    signal,
  });
}

export function getUsers(query, options = {}) {
  return apiRequest("/api/users", { query, ...options });
}

export function getUser(id) {
  return apiRequest(`/api/users/${id}`);
}

export function createUser(body) {
  return apiRequest("/api/users", { method: "POST", body });
}

export function updateUser(id, body) {
  return apiRequest(`/api/users/${id}`, { method: "PATCH", body });
}

export function resetUserPassword(id, password) {
  return apiRequest(`/api/users/${id}/reset-password`, {
    method: "POST",
    body: { password },
  });
}

export function getUserSummary() {
  return apiRequest("/api/users/summary");
}

export function getRoles(query) {
  return apiRequest("/api/roles", { query });
}

export function getPermissions(query) {
  return apiRequest("/api/permissions", { query });
}

export function createRole(body) {
  return apiRequest("/api/roles", { method: "POST", body });
}

export function updateRole(id, body) {
  return apiRequest(`/api/roles/${id}`, { method: "PATCH", body });
}

export function deleteRole(id) {
  return apiRequest(`/api/roles/${id}`, { method: "DELETE" });
}

export function getRolePermissions(id) {
  return apiRequest(`/api/roles/${id}/permissions`);
}

export function updateRolePermissions(id, permissionIds) {
  return apiRequest(`/api/roles/${id}/permissions`, {
    method: "PUT",
    body: { permission_ids: permissionIds },
  });
}
