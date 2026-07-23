require("dotenv").config({ quiet: true });

const nodeEnv = process.env.NODE_ENV || "development";
const jwtSecret = process.env.JWT_SECRET || "change-this-secret";

if (nodeEnv === "production" && (jwtSecret === "change-this-secret" || jwtSecret.length < 32)) {
  throw new Error("JWT_SECRET must be set to a strong secret of at least 32 characters in production");
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
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
    jwtIssuer: process.env.JWT_ISSUER || "pkl-api",
    jwtAudience: process.env.JWT_AUDIENCE || "pkl-api-users",
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
    rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
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
