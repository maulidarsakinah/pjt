const logger = require("../logger");

const AUDIT_SCHEMA_VERSION = 1;

function getClientIp(req) {
  return req.ip || req.socket?.remoteAddress;
}

function getRequestPath(req) {
  return (req.originalUrl || req.url || "").split("?")[0];
}

function defaultSeverity(outcome) {
  return outcome === "success" ? "info" : "warning";
}

function defaultLogLevel(outcome, severity) {
  if (severity === "critical" || severity === "error") {
    return "error";
  }

  if (outcome !== "success" || severity === "warning") {
    return "warn";
  }

  return "info";
}

function compactObject(value) {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  );
}

function writeAuditEvent(req, event) {
  const outcome = event.outcome || "success";
  const severity = event.severity || defaultSeverity(outcome);
  const logTarget = req?.log || logger;
  const logLevel = defaultLogLevel(outcome, severity);

  const payload = {
    audit: true,
    audit_schema_version: AUDIT_SCHEMA_VERSION,
    event_category: event.category,
    event_action: event.action,
    event_outcome: outcome,
    event_severity: severity,
    actor: compactObject({
      user_id: event.actorUserId ?? req?.user?.id,
    }),
    target: compactObject({
      type: event.targetType,
      id: event.targetId,
    }),
    request: compactObject({
      trace_id: req?.trace_id || req?.id,
      method: req?.method,
      path: req ? getRequestPath(req) : undefined,
      route: req?.route?.path,
      ip: req ? getClientIp(req) : undefined,
      user_agent: req?.headers?.["user-agent"],
    }),
    metadata: event.metadata || {},
  };

  logTarget[logLevel](payload, "audit_event");
}

module.exports = {
  writeAuditEvent,
};
