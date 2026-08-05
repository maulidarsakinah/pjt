const logger = require("../logger");

const AUDIT_SCHEMA_VERSION = 1;
const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH"]);
const MAX_FIELDS = 100;
const MAX_ARRAY_ITEMS = 25;
const MAX_STRING_LENGTH = 120;
const SENSITIVE_FIELD_PATTERN =
  /(password|passcode|token|jwt|secret|authorization|cookie|session|card|cvv|iban|bank|account.?number|ssn|nik|ktp|passport|address|phone|email|encrypt|hash)/i;
const SAFE_VALUE_FIELDS = new Set([
  "active",
  "category",
  "count",
  "enabled",
  "guard_name",
  "quantity",
  "status",
  "type",
]);

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

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isSafeValueField(field, targetType) {
  return (
    !SENSITIVE_FIELD_PATTERN.test(field) &&
    (SAFE_VALUE_FIELDS.has(field) ||
      field === "id" ||
      field.endsWith("_id") ||
      field.endsWith("_ids") ||
      (field === "name" && ["permission", "role"].includes(targetType)))
  );
}

function summarizeSafeValue(value) {
  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…`
      : value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .filter(
        (entry) =>
          typeof entry === "string" ||
          typeof entry === "number" ||
          typeof entry === "boolean" ||
          entry === null,
      )
      .map(summarizeSafeValue);
  }

  return undefined;
}

function valuesEqual(left, right) {
  if (Array.isArray(left) && Array.isArray(right)) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  return left === right;
}

function buildFieldChanges(before, after, fields, { targetType } = {}) {
  const changes = {};

  for (const field of [...new Set(fields || [])].slice(0, MAX_FIELDS)) {
    const previousValue = before?.[field];
    const nextValue = after?.[field];

    if (valuesEqual(previousValue, nextValue)) {
      continue;
    }

    changes[field] = isSafeValueField(field, targetType)
      ? compactObject({
          from: summarizeSafeValue(previousValue),
          to: summarizeSafeValue(nextValue),
        })
      : { changed: true, value_logged: false };
  }

  return changes;
}

function getPayloadBytes(req) {
  const contentLength = Number(req?.headers?.["content-length"]);

  if (Number.isSafeInteger(contentLength) && contentLength >= 0) {
    return contentLength;
  }

  if (req?.body === undefined) {
    return 0;
  }

  try {
    return Buffer.byteLength(JSON.stringify(req.body), "utf8");
  } catch {
    return undefined;
  }
}

function getResourceFromPath(req) {
  return getRequestPath(req).split("/").filter(Boolean)[1];
}

function buildMutationMetadata(req, overrides = {}) {
  if (!MUTATION_METHODS.has(req?.method)) {
    return undefined;
  }

  const body = isPlainObject(req.body) ? req.body : {};
  const allFields = Object.keys(body).sort();
  const fieldsTouched = allFields.slice(0, MAX_FIELDS);
  const targetType = overrides.targetType || getResourceFromPath(req);
  const safeValues = {};

  for (const field of fieldsTouched) {
    if (isSafeValueField(field, targetType)) {
      const value = summarizeSafeValue(body[field]);

      if (value !== undefined) {
        safeValues[field] = value;
      }
    }
  }

  return compactObject({
    payload_bytes: getPayloadBytes(req),
    fields_touched: fieldsTouched,
    fields_truncated: allFields.length > MAX_FIELDS || undefined,
    safe_values: Object.keys(safeValues).length ? safeValues : undefined,
    changes: overrides.changes,
    target: compactObject({
      type: targetType,
      id: overrides.targetId ?? req.params?.id,
    }),
  });
}

function attachMutationAudit(req, overrides = {}) {
  const mutation = buildMutationMetadata(req, overrides);

  if (mutation) {
    req.auditMutation = {
      ...req.auditMutation,
      ...mutation,
      target: {
        ...req.auditMutation?.target,
        ...mutation.target,
      },
    };
  }

  return req.auditMutation;
}

function writeAuditEvent(req, event) {
  const outcome = event.outcome || "success";
  const severity = event.severity || defaultSeverity(outcome);
  const logTarget = req?.log || logger;
  const logLevel = defaultLogLevel(outcome, severity);
  const mutation = attachMutationAudit(req, {
    targetType: event.targetType,
    targetId: event.targetId,
    changes: event.changes,
  });

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
    metadata: {
      ...(event.metadata || {}),
      ...(mutation ? { mutation } : {}),
    },
  };

  logTarget[logLevel](payload, "audit_event");
}

module.exports = {
  attachMutationAudit,
  buildFieldChanges,
  buildMutationMetadata,
  writeAuditEvent,
};
