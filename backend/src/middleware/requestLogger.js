const crypto = require("crypto");
const { performance } = require("perf_hooks");
const logger = require("../logger");
const { buildMutationMetadata } = require("../services/audit");

function shouldSkipRequestLog(req, statusCode) {
  const requestPath = getRequestPath(req);
  const requestUrl = req.url || req.originalUrl || "";

  return (
    (requestUrl.startsWith("/api/docs/") &&
      /\.(css|js|png|ico|map)$/.test(requestUrl)) ||
    (req.method === "GET" &&
      requestPath.startsWith("/api/logs") &&
      statusCode < 400)
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

function isAuditReadRequest(req) {
  return req.method === "GET" && getRequestPath(req).startsWith("/api/logs");
}

function getJourneyLogLevel(stage, outcome) {
  if (outcome === "failed") {
    return "warn";
  }

  if (stage === "authentication" || stage === "authorization") {
    return "debug";
  }

  return "info";
}

function logJourneyStage(req, stage, outcome = "success", fields = {}) {
  if (req.skipJourneyLog || !req.log) {
    return;
  }

  const level = getJourneyLogLevel(stage, outcome);
  req.log[level](
    {
      journey: true,
      journey_stage: stage,
      journey_outcome: outcome,
      method: req.method,
      path: getRequestPath(req),
      user_id: req.user?.id,
      ...fields,
    },
    "journey_stage",
  );
}

module.exports = (req, res, next) => {
  const traceId =
    req.headers["x-trace-id"] ||
    req.headers["x-request-id"] ||
    `tx-${crypto.randomUUID()}`;
  const startedAt = performance.now();
  let terminalLogged = false;

  req.id = traceId;
  req.trace_id = traceId;
  req.log = logger.child({ trace_id: traceId });
  req.skipJourneyLog = isAuditReadRequest(req);

  logJourneyStage(req, "request_received");

  res.setHeader("x-trace-id", traceId);
  res.setHeader("x-request-id", traceId);

  res.once("finish", () => {
    terminalLogged = true;

    if (shouldSkipRequestLog(req, res.statusCode)) {
      return;
    }

    const statusCode = res.statusCode;
    const latencyMs = Math.round(performance.now() - startedAt);
    const level = getLogLevel(statusCode);
    const status = statusCode >= 400 ? "failed" : "success";
    const mutation = req.auditMutation || buildMutationMetadata(req);

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
        journey: true,
        journey_stage: "response_completed",
        journey_outcome: status,
        mutation,
      },
      "request_completed",
    );
  });

  res.once("close", () => {
    if (terminalLogged || res.writableFinished || req.skipJourneyLog) {
      return;
    }

    terminalLogged = true;
    req.log.warn(
      {
        method: req.method,
        path: getRequestPath(req),
        ip: getClientIp(req),
        user_agent: req.headers["user-agent"],
        status: "failed",
        status_code: res.headersSent ? res.statusCode : undefined,
        latency_ms: Math.round(performance.now() - startedAt),
        user_id: req.user?.id,
        journey: true,
        journey_stage: "request_aborted",
        journey_outcome: "failed",
        error_code: "CLIENT_ABORTED",
        mutation: req.auditMutation || buildMutationMetadata(req),
      },
      "request_aborted",
    );
  });

  next();
};

module.exports.shouldSkipRequestLog = shouldSkipRequestLog;
module.exports.getJourneyLogLevel = getJourneyLogLevel;
module.exports.logJourneyStage = logJourneyStage;
