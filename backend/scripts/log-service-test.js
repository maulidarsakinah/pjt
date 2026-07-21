const assert = require("assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const requestLogger = require("../src/middleware/requestLogger");
const {
  clearLogCache,
  getLogCacheStats,
  listLogs,
  normalizeLogEntry,
  parseLogFilters,
} = require("../src/services/logs");

async function main() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "pkl-log-test-"));

  try {
    clearLogCache();
    const entries = [
      {
        level: "info",
        time: "2026-07-20T01:00:00.000Z",
        service: "pkl-api",
        trace_id: "tx-success",
        method: "GET",
        path: "/api/health",
        status: "success",
        status_code: 200,
        message: "request_completed",
        token: "must-not-be-returned",
      },
      {
        level: "warn",
        time: "2026-07-20T02:00:00.000Z",
        service: "pkl-api",
        trace_id: "tx-failed",
        method: "POST",
        path: "/api/login",
        status: "failed",
        status_code: 401,
        error_message: "authentication required",
        message: "request_error",
      },
      {
        level: "info",
        time: "2026-07-20T03:00:00.000Z",
        service: "pkl-api",
        trace_id: "tx-audit-read",
        method: "GET",
        path: "/api/logs",
        status: "success",
        status_code: 200,
        message: "request_completed",
      },
    ];

    await fs.writeFile(
      path.join(directory, "app.20-07-26.1.log"),
      `${entries.map((entry) => JSON.stringify(entry)).join("\n")}\nnot-json\n`,
      "utf8"
    );

    const response = await listLogs({
      directory,
      pagination: { limit: 1, offset: 0 },
      filters: parseLogFilters({ status: "failed", method: "post", date: "2026-07-20" }),
    });

    assert.equal(response.count, 1);
    assert.equal(response.total, 1);
    assert.equal(response.data[0].trace_id, "tx-failed");
    assert.equal(response.data[0].method, "POST");
    assert.match(response.data[0].id, /^[a-f0-9]{24}$/);
    assert.equal(Object.hasOwn(response.data[0], "token"), false);

    const repeatedResponse = await listLogs({
      directory,
      pagination: { limit: 1, offset: 0 },
      filters: parseLogFilters({ status: "failed" }),
    });

    assert.equal(repeatedResponse.data[0].id, response.data[0].id);

    const secondPage = await listLogs({
      directory,
      pagination: { limit: 1, offset: 1 },
      filters: parseLogFilters({}),
    });

    assert.equal(secondPage.count, 1);
    assert.equal(secondPage.total, 2);
    assert.equal(secondPage.data[0].trace_id, "tx-success");
    assert.equal(secondPage.has_more, false);
    assert.equal(secondPage.data.some((entry) => entry.trace_id === "tx-audit-read"), false);

    await fs.appendFile(
      path.join(directory, "app.20-07-26.1.log"),
      `${JSON.stringify({
        level: "info",
        time: "2026-07-20T04:00:00.000Z",
        trace_id: "tx-new-entry",
        method: "GET",
        path: "/api/health",
        status: "success",
        status_code: 200,
      })}\n`,
      "utf8"
    );

    const cachedSecondPage = await listLogs({
      directory,
      pagination: { limit: 1, offset: 1 },
      filters: parseLogFilters({}),
    });

    assert.deepEqual(cachedSecondPage, secondPage);
    assert.deepEqual(getLogCacheStats(), { countItems: 3, pageItems: 3 });

    const refreshedResponse = await listLogs({
      directory,
      pagination: { limit: 10, offset: 0 },
      filters: parseLogFilters({}),
      now: Date.now() + 6000,
    });

    assert.equal(refreshedResponse.total, 3);
    assert.equal(refreshedResponse.data[0].trace_id, "tx-new-entry");

    const cacheTestNow = Date.now() + 6001;

    for (let offset = 0; offset <= 100; offset += 1) {
      await listLogs({
        directory,
        pagination: { limit: 1, offset },
        filters: parseLogFilters({}),
        now: cacheTestNow,
      });
    }

    assert.equal(getLogCacheStats().pageItems, 100);
    clearLogCache();

    const searchResponse = await listLogs({
      directory,
      pagination: { limit: 10, offset: 0 },
      filters: parseLogFilters({ search: "NEW-ENTRY" }),
    });

    assert.equal(searchResponse.total, 1);
    assert.equal(searchResponse.data[0].trace_id, "tx-new-entry");
    assert.throws(() => parseLogFilters({ search: "x".repeat(201) }), /200 characters or fewer/);
    assert.equal(normalizeLogEntry(null), null);
    assert.throws(() => parseLogFilters({ date: "2026-02-30" }), /valid calendar date/);
    assert.equal(requestLogger.shouldSkipRequestLog({ method: "GET", originalUrl: "/api/logs" }, 200), true);
    assert.equal(requestLogger.shouldSkipRequestLog({ method: "GET", originalUrl: "/api/logs" }, 401), false);

    console.log("Log service tests passed");
  } finally {
    clearLogCache();
    await fs.rm(directory, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
