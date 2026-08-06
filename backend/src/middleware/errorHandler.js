const logger = require("../logger");

function getClientIp(req) {
  return req.ip || req.socket.remoteAddress;
}

function getRequestPath(req) {
  return (req.originalUrl || req.url || "").split("?")[0];
}

function getErrorSource(error) {
  if (error.code && String(error.code).startsWith("ORA-")) {
    return "oracle";
  }

  if (error.code && String(error.code).startsWith("NJS-")) {
    return "oracle_driver";
  }

  if (
    error.name === "JsonWebTokenError" ||
    error.name === "TokenExpiredError"
  ) {
    return "auth";
  }

  if (error.type === "entity.parse.failed") {
    return "request_body";
  }

  return "application";
}

function getErrorCode(error, statusCode) {
  return error.code || error.name || `HTTP_${statusCode}`;
}

function getPublicCode(error, statusCode) {
  if (error.publicCode) {
    return error.publicCode;
  }

  if (statusCode === 400) {
    return "BAD_REQUEST";
  }

  if (statusCode === 401) {
    return "UNAUTHORIZED";
  }

  if (statusCode === 403) {
    return "FORBIDDEN";
  }

  if (statusCode === 404) {
    return "NOT_FOUND";
  }

  if (statusCode === 409) {
    return "CONFLICT";
  }

  if (statusCode === 413) {
    return "PAYLOAD_TOO_LARGE";
  }

  if (statusCode === 415) {
    return "UNSUPPORTED_MEDIA_TYPE";
  }

  if (statusCode === 429) {
    return "RATE_LIMITED";
  }

  return statusCode >= 500 ? "INTERNAL_SERVER_ERROR" : `HTTP_${statusCode}`;
}

function getPublicMessage(error, statusCode) {
  if (error.publicMessage) {
    return error.publicMessage;
  }

  if (statusCode === 413) {
    return "Request body too large";
  }

  if (statusCode === 400 && error.type === "entity.parse.failed") {
    return "Invalid JSON request body";
  }

  if (statusCode >= 500) {
    return "Internal server error";
  }

  if (getErrorSource(error) === "oracle" || getErrorSource(error) === "oracle_driver") {
    return "Internal server error";
  }

  return error.message;
}

function buildErrorLogPayload(error, req, statusCode, traceId) {
  const payload = {
    method: req.method,
    path: getRequestPath(req),
    route: req.route?.path,
    ip: getClientIp(req),
    user_agent: req.headers["user-agent"],
    user_id: req.user?.id,
    status: "failed",
    status_code: statusCode,
    error_source: getErrorSource(error),
    error_code: getErrorCode(error, statusCode),
    error_message: error.message,
    journey: true,
    journey_stage: "request_failed",
    journey_outcome: "failed",
  };

  if (error.errorNum !== undefined) {
    payload.oracle_error_num = error.errorNum;
  }

  if (error.offset !== undefined) {
    payload.oracle_error_offset = error.offset;
  }

  if (error.isRecoverable !== undefined) {
    payload.is_recoverable = error.isRecoverable;
  }

  if (statusCode >= 500) {
    payload.err = error;
  }

  return payload;
}

module.exports = (error, req, res, next) => {
  const statusCode = error.statusCode || error.status || 500;
  const traceId = req.trace_id || req.id;
  const logTarget = req.log || logger.child({ trace_id: traceId });
  const log =
    statusCode >= 500
      ? logTarget.error.bind(logTarget)
      : logTarget.warn.bind(logTarget);

  log(buildErrorLogPayload(error, req, statusCode, traceId), "request_error");

  res.status(statusCode).json({
    error: getPublicMessage(error, statusCode),
    code: getPublicCode(error, statusCode),
    trace_id: traceId,
  });
};
