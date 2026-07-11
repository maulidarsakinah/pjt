const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const config = require("../config");

function corsAllowlist(req, res, next) {
  const origin = req.headers.origin;

  if (!origin || config.security.corsOrigins.length === 0) {
    next();
    return;
  }

  if (!config.security.corsOrigins.includes(origin)) {
    req.log?.warn(
      {
        status: "failed",
        status_code: 403,
        origin,
      },
      "cors_origin_denied"
    );

    res.status(403).json({
      error: "Origin not allowed",
      code: "ORIGIN_NOT_ALLOWED",
      trace_id: req.trace_id,
    });
    return;
  }

  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-Id, X-Trace-Id");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).send();
    return;
  }

  next();
}

const securityHeaders = helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: {
    policy: "same-origin",
  },
});

function createRateLimitHandler(message) {
  return (req, res) => {
    req.log.warn(
      {
        status: "failed",
        status_code: 429,
        error: message,
      },
      "rate_limit_exceeded"
    );

    res.status(429).json({
      error: message,
      code: "RATE_LIMITED",
      trace_id: req.trace_id,
    });
  };
}

const generalRateLimit = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  limit: config.security.rateLimitMax,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: "Too many requests",
  handler: createRateLimitHandler("Too many requests"),
});

const authRateLimit = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  limit: config.security.authRateLimitMax,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: "Too many authentication attempts",
  skipSuccessfulRequests: true,
  handler: createRateLimitHandler("Too many authentication attempts"),
});

module.exports = {
  authRateLimit,
  corsAllowlist,
  generalRateLimit,
  securityHeaders,
};
