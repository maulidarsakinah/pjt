const crypto = require("crypto");
const { performance } = require("perf_hooks");
const logger = require("../logger");

function shouldSkipRequestLog(req) {
  return (
    req.url.startsWith("/api/docs/") &&
    /\.(css|js|png|ico|map)$/.test(req.url)
  );
}

function getLogLevel(statusCode) {
  if (statusCode >= 500) {
    return "error";
  }

  if (statusCode >= 400) {
    return "warn";
  }

  return "info";
}

function getClientIp(req) {
  return req.ip || req.socket.remoteAddress;
}

function getRequestPath(req) {
  return (req.originalUrl || req.url || "").split("?")[0];
}

module.exports = (req, res, next) => {
  const traceId =
    req.headers["x-trace-id"] ||
    req.headers["x-request-id"] ||
    `tx-${crypto.randomUUID()}`;
  const startedAt = performance.now();

  req.id = traceId;
  req.trace_id = traceId;
  req.log = logger.child({ trace_id: traceId });

  res.setHeader("x-trace-id", traceId);
  res.setHeader("x-request-id", traceId);

  res.on("finish", () => {
    if (shouldSkipRequestLog(req)) {
      return;
    }

    const statusCode = res.statusCode;
    const latencyMs = Math.round(performance.now() - startedAt);
    const level = getLogLevel(statusCode);
    const status = statusCode >= 400 ? "failed" : "success";

    req.log[level](
      {
        method: req.method,
        path: getRequestPath(req),
        ip: getClientIp(req),
        user_agent: req.headers["user-agent"],
        status,
        status_code: statusCode,
        latency_ms: latencyMs,
        user_id: req.user?.id,
      },
      "request_completed"
    );
  });

  next();
};
