require("dotenv").config({ quiet: true });

const nodeEnv = process.env.NODE_ENV || "development";
const jwtSecret = process.env.JWT_SECRET || "change-this-secret";
const refreshTokenSecret =
  process.env.REFRESH_TOKEN_SECRET || "change-this-refresh-secret";
const refreshTokenTtlSeconds =
  process.env.REFRESH_TOKEN_TTL_SECONDS === undefined
    ? 7 * 24 * 60 * 60
    : Number(process.env.REFRESH_TOKEN_TTL_SECONDS);
const refreshCookieNameBase =
  process.env.REFRESH_COOKIE_NAME || "hydrotrack_refresh";
const refreshCookieName =
  nodeEnv === "production"
    ? `__Host-${refreshCookieNameBase}`
    : refreshCookieNameBase;
const insecureRefreshTokenSecrets = new Set([
  "change-this-refresh-secret",
  "change-this-to-a-different-long-random-secret",
  "replace-with-a-different-random-secret-before-production",
]);
const revocationMaxItems =
  process.env.TOKEN_REVOCATION_MAX_ITEMS === undefined
    ? 10000
    : Number(process.env.TOKEN_REVOCATION_MAX_ITEMS);

if (
  nodeEnv === "production" &&
  (jwtSecret === "change-this-secret" || jwtSecret.length < 32)
) {
  throw new Error(
    "JWT_SECRET must be set to a strong secret of at least 32 characters in production",
  );
}

if (
  nodeEnv === "production" &&
  (insecureRefreshTokenSecrets.has(refreshTokenSecret) ||
    refreshTokenSecret.length < 32)
) {
  throw new Error(
    "REFRESH_TOKEN_SECRET must be set to a strong secret of at least 32 characters in production",
  );
}

if (!Number.isInteger(refreshTokenTtlSeconds) || refreshTokenTtlSeconds <= 0) {
  throw new Error("REFRESH_TOKEN_TTL_SECONDS must be a positive integer");
}

if (!/^(__Host-)?[A-Za-z0-9_-]+$/.test(refreshCookieName)) {
  throw new Error(
    "REFRESH_COOKIE_NAME may contain only letters, numbers, underscores, and hyphens",
  );
}

if (!Number.isInteger(revocationMaxItems) || revocationMaxItems <= 0) {
  throw new Error("TOKEN_REVOCATION_MAX_ITEMS must be a positive integer");
}

const config = {
  nodeEnv,
  port: Number(process.env.PORT) || 3000,
  db: {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.DB_CONNECT_STRING,
    useThickMode: process.env.ORACLE_USE_THICK_MODE === "true",
    oracleClientLibDir: process.env.ORACLE_CLIENT_LIB_DIR,
    poolMin: Number(process.env.DB_POOL_MIN) || 1,
    poolMax: Number(process.env.DB_POOL_MAX) || 10,
    poolIncrement: Number(process.env.DB_POOL_INCREMENT) || 1,
    poolTimeout: Number(process.env.DB_POOL_TIMEOUT) || 60,
    statementCacheSize: Number(process.env.DB_STATEMENT_CACHE_SIZE) || 30,
  },
  auth: {
    jwtSecret,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "15m",
    jwtIssuer: process.env.JWT_ISSUER || "pkl-api",
    jwtAudience: process.env.JWT_AUDIENCE || "pkl-api-users",
    refreshTokenSecret,
    refreshTokenTtlSeconds,
    refreshTokenAudience:
      process.env.REFRESH_TOKEN_AUDIENCE || "pkl-api-refresh",
    refreshCookieName,
    refreshCookieSecure:
      nodeEnv === "production" || process.env.REFRESH_COOKIE_SECURE === "true",
    revocationMaxItems,
  },
  security: {
    bodyLimit: process.env.BODY_LIMIT || "100kb",
    corsOrigins: (process.env.CORS_ORIGINS || "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    docsEnabled:
      process.env.ENABLE_DOCS === "true" ||
      (process.env.ENABLE_DOCS !== "false" && nodeEnv !== "production"),
    trustProxy: process.env.TRUST_PROXY === "true" ? 1 : false,
    rateLimitWindowMs:
      Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 300,
    authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,
  },
  logging: {
    fileEnabled: process.env.LOG_TO_FILE !== "false",
    filePath: process.env.LOG_FILE_PATH || "logs/app.log",
    retentionCount: Number(process.env.LOG_RETENTION_COUNT) || 30,
  },
  cache: {
    authTtlMs: (Number(process.env.AUTH_CACHE_TTL_SECONDS) || 30) * 1000,
    authMaxItems: Number(process.env.AUTH_CACHE_MAX_ITEMS) || 5000,
    stationTtlMs: (Number(process.env.STATION_CACHE_TTL_SECONDS) || 300) * 1000,
    stationMaxItems: Number(process.env.STATION_CACHE_MAX_ITEMS) || 1000,
  },
};

module.exports = config;
