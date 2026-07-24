const fs = require("fs/promises");
const crypto = require("crypto");
const path = require("path");
const config = require("../config");
const { badRequest } = require("../utils/httpErrors");

const backendRoot = path.resolve(__dirname, "..", "..");
const configuredLogPath = path.isAbsolute(config.logging.filePath)
  ? config.logging.filePath
  : path.resolve(backendRoot, config.logging.filePath);
const DEFAULT_LOG_DIRECTORY = path.dirname(configuredLogPath);
const MAX_LOG_FILE_BYTES = 20 * 1024 * 1024;
const LOG_CACHE_TTL_MS = 5 * 1000;
const MAX_COUNT_CACHE_ITEMS = 50;
const MAX_PAGE_CACHE_ITEMS = 100;
const ALLOWED_LEVELS = new Set([
  "trace",
  "debug",
  "info",
  "warn",
  "error",
  "fatal",
]);
const ALLOWED_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
  "HEAD",
]);
const ALLOWED_STATUSES = new Set(["success", "failed"]);
const jakartaDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const countCache = new Map();
const pageCache = new Map();

function getCachedValue(cache, key, now) {
  const cached = cache.get(key);

  if (!cached) {
    return undefined;
  }

  if (cached.expiresAt <= now) {
    cache.delete(key);
    return undefined;
  }

  cache.delete(key);
  cache.set(key, cached);
  return cached.value;
}

function setCachedValue(cache, key, value, maxItems, now) {
  cache.delete(key);
  cache.set(key, {
    expiresAt: now + LOG_CACHE_TTL_MS,
    value,
  });

  while (cache.size > maxItems) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

function buildFilterCacheKey(directory, filters) {
  return [
    path.resolve(directory),
    filters.date || "",
    filters.level || "",
    filters.method || "",
    filters.status || "",
    filters.search || "",
  ].join("|");
}

function cloneListResponse(response) {
  return {
    ...response,
    data: response.data.map((entry) => ({ ...entry })),
  };
}

function clearLogCache() {
  countCache.clear();
  pageCache.clear();
}

function getLogCacheStats() {
  return {
    countItems: countCache.size,
    pageItems: pageCache.size,
  };
}

function parseOptionalEnum(
  value,
  field,
  allowedValues,
  transform = (entry) => entry,
) {
  if (value === undefined || value === "") {
    return undefined;
  }

  const normalized = transform(String(value).trim());

  if (!allowedValues.has(normalized)) {
    throw badRequest(`${field} is invalid`);
  }

  return normalized;
}

function parseDate(value) {
  if (value === undefined || value === "") {
    return undefined;
  }

  const normalized = String(value).trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw badRequest("date must use YYYY-MM-DD");
  }

  const parsed = new Date(`${normalized}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw badRequest("date must be a valid calendar date");
  }

  return normalized;
}

function parseSearch(value) {
  if (value === undefined || value === "") {
    return undefined;
  }

  const normalized = String(value).trim().toLowerCase();

  if (normalized.length > 200) {
    throw badRequest("search must be 200 characters or fewer");
  }

  return normalized || undefined;
}

function parseLogFilters(query) {
  return {
    date: parseDate(query.date),
    level: parseOptionalEnum(query.level, "level", ALLOWED_LEVELS, (value) =>
      value.toLowerCase(),
    ),
    method: parseOptionalEnum(
      query.method,
      "method",
      ALLOWED_METHODS,
      (value) => value.toUpperCase(),
    ),
    status: parseOptionalEnum(
      query.status,
      "status",
      ALLOWED_STATUSES,
      (value) => value.toLowerCase(),
    ),
    search: parseSearch(query.search),
  };
}

function inferStatus(entry) {
  if (entry.status === "success" || entry.status === "failed") {
    return entry.status;
  }

  if (entry.event_outcome) {
    return entry.event_outcome === "success" ? "success" : "failed";
  }

  if (
    Number(entry.status_code) >= 400 ||
    entry.level === "error" ||
    entry.level === "fatal"
  ) {
    return "failed";
  }

  return "success";
}

function normalizeLogEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }

  const request =
    entry.request && typeof entry.request === "object" ? entry.request : {};
  const time = typeof entry.time === "string" ? entry.time : undefined;

  if (!time || Number.isNaN(Date.parse(time))) {
    return null;
  }

  return {
    level: typeof entry.level === "string" ? entry.level : "info",
    time,
    service: typeof entry.service === "string" ? entry.service : undefined,
    env: typeof entry.env === "string" ? entry.env : undefined,
    trace_id: entry.trace_id || request.trace_id,
    method: entry.method || request.method,
    path: entry.path || request.path,
    ip: entry.ip || request.ip,
    user_agent: entry.user_agent || request.user_agent,
    status: inferStatus(entry),
    status_code: Number.isInteger(entry.status_code)
      ? entry.status_code
      : undefined,
    latency_ms: Number.isFinite(entry.latency_ms)
      ? entry.latency_ms
      : undefined,
    error_source:
      typeof entry.error_source === "string" ? entry.error_source : undefined,
    error_code:
      typeof entry.error_code === "string" ? entry.error_code : undefined,
    error_message:
      typeof entry.error_message === "string" ? entry.error_message : undefined,
    message: typeof entry.message === "string" ? entry.message : undefined,
  };
}

function formatJakartaDate(value) {
  const parts = Object.fromEntries(
    jakartaDateFormatter
      .formatToParts(new Date(value))
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function matchesFilters(entry, filters) {
  const searchValues = [
    entry.trace_id,
    entry.method,
    entry.path,
    entry.message,
    entry.error_code,
    entry.error_message,
  ];

  return (
    (!filters.date || formatJakartaDate(entry.time) === filters.date) &&
    (!filters.level || entry.level === filters.level) &&
    (!filters.method || entry.method === filters.method) &&
    (!filters.status || entry.status === filters.status) &&
    (!filters.search ||
      searchValues.some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(filters.search),
      ))
  );
}

function isSuccessfulAuditRead(entry) {
  return (
    entry.method === "GET" &&
    entry.path === "/api/logs" &&
    entry.status === "success"
  );
}

async function listLogFiles(directory) {
  let entries;

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".log"))
      .map(async (entry) => {
        const filePath = path.join(directory, entry.name);
        const stats = await fs.stat(filePath);

        return { filePath, modifiedAt: stats.mtimeMs };
      }),
  );

  return files.sort((left, right) => right.modifiedAt - left.modifiedAt);
}

async function readRecentLines(filePath) {
  const handle = await fs.open(filePath, "r");

  try {
    const stats = await handle.stat();
    const start = Math.max(0, stats.size - MAX_LOG_FILE_BYTES);
    const length = stats.size - start;
    const buffer = Buffer.alloc(length);

    if (length > 0) {
      await handle.read(buffer, 0, length, start);
    }

    let content = buffer.toString("utf8");
    let contentStart = start;

    if (start > 0) {
      const firstLineEnd = content.indexOf("\n");

      if (firstLineEnd === -1) {
        content = "";
      } else {
        const skippedContent = content.slice(0, firstLineEnd + 1);
        contentStart += Buffer.byteLength(skippedContent, "utf8");
        content = content.slice(firstLineEnd + 1);
      }
    }

    const lines = [];
    const linePattern = /.*?(?:\r\n|\n|$)/g;
    let byteOffset = contentStart;

    for (const match of content.matchAll(linePattern)) {
      const segment = match[0];

      if (!segment) {
        continue;
      }

      const line = segment.replace(/\r?\n$/, "");

      if (line) {
        lines.push({ line, byteOffset });
      }

      byteOffset += Buffer.byteLength(segment, "utf8");
    }

    return lines.reverse();
  } finally {
    await handle.close();
  }
}

async function listLogs({
  pagination,
  filters,
  directory = DEFAULT_LOG_DIRECTORY,
  now = Date.now(),
}) {
  const filterCacheKey = buildFilterCacheKey(directory, filters);
  const pageCacheKey = `${filterCacheKey}|${pagination.limit}|${pagination.offset}`;
  const cachedPage = getCachedValue(pageCache, pageCacheKey, now);

  if (cachedPage) {
    return cloneListResponse(cachedPage);
  }

  const cachedTotal = getCachedValue(countCache, filterCacheKey, now);

  if (cachedTotal !== undefined && pagination.offset >= cachedTotal) {
    const emptyResponse = {
      data: [],
      count: 0,
      total: cachedTotal,
      limit: pagination.limit,
      offset: pagination.offset,
      has_more: false,
    };

    setCachedValue(
      pageCache,
      pageCacheKey,
      emptyResponse,
      MAX_PAGE_CACHE_ITEMS,
      now,
    );
    return cloneListResponse(emptyResponse);
  }

  const page = [];
  let matchedCount = 0;
  const files = await listLogFiles(directory);

  fileLoop: for (const file of files) {
    const lines = await readRecentLines(file.filePath);

    for (const lineRecord of lines) {
      let parsed;

      try {
        parsed = JSON.parse(lineRecord.line);
      } catch {
        continue;
      }

      const entry = normalizeLogEntry(parsed);

      if (
        entry &&
        !isSuccessfulAuditRead(entry) &&
        matchesFilters(entry, filters)
      ) {
        if (
          matchedCount >= pagination.offset &&
          page.length < pagination.limit
        ) {
          const id = crypto
            .createHash("sha256")
            .update(`${path.basename(file.filePath)}:${lineRecord.byteOffset}`)
            .digest("hex")
            .slice(0, 24);

          page.push({ id, ...entry });
        }

        matchedCount += 1;

        if (
          cachedTotal !== undefined &&
          matchedCount >= pagination.offset + pagination.limit
        ) {
          break fileLoop;
        }
      }
    }
  }

  const total = cachedTotal === undefined ? matchedCount : cachedTotal;

  if (cachedTotal === undefined) {
    setCachedValue(
      countCache,
      filterCacheKey,
      total,
      MAX_COUNT_CACHE_ITEMS,
      now,
    );
  }

  const response = {
    data: page,
    count: page.length,
    total,
    limit: pagination.limit,
    offset: pagination.offset,
    has_more: total > pagination.offset + pagination.limit,
  };

  setCachedValue(pageCache, pageCacheKey, response, MAX_PAGE_CACHE_ITEMS, now);
  return cloneListResponse(response);
}

module.exports = {
  DEFAULT_LOG_DIRECTORY,
  clearLogCache,
  getLogCacheStats,
  listLogs,
  normalizeLogEntry,
  parseLogFilters,
};
