const oracledb = require("oracledb");
const config = require("./config");

let oracleClientInitError;
let poolPromise;

if (config.db.useThickMode) {
  const clientOptions = config.db.oracleClientLibDir
    ? { libDir: config.db.oracleClientLibDir }
    : {};

  try {
    oracledb.initOracleClient(clientOptions);
  } catch (error) {
    oracleClientInitError = error;
  }
}

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
oracledb.fetchArraySize = 100;

function validateDbConfig() {
  if (oracleClientInitError) {
    const error = new Error(
      `Oracle Thick mode failed to initialize: ${oracleClientInitError.message}`
    );
    error.statusCode = 500;
    error.publicMessage =
      "Oracle Instant Client is required for Oracle Database 11.2. Set ORACLE_CLIENT_LIB_DIR in .env.";
    throw error;
  }

  if (!config.db.user || !config.db.password || !config.db.connectString) {
    const error = new Error("DB_USER, DB_PASSWORD, and DB_CONNECT_STRING environment variables are required");
    error.statusCode = 500;
    error.publicMessage = "Database configuration is incomplete";
    throw error;
  }
}

function getPool() {
  validateDbConfig();

  if (!poolPromise) {
    poolPromise = oracledb
      .createPool({
        user: config.db.user,
        password: config.db.password,
        connectString: config.db.connectString,
        poolMin: config.db.poolMin,
        poolMax: config.db.poolMax,
        poolIncrement: config.db.poolIncrement,
        poolTimeout: config.db.poolTimeout,
        stmtCacheSize: config.db.statementCacheSize,
      })
      .catch((error) => {
        poolPromise = undefined;
        throw error;
      });
  }

  return poolPromise;
}

async function getConnection() {
  const pool = await getPool();
  return pool.getConnection();
}

async function closePool() {
  if (!poolPromise) {
    return;
  }

  const pool = await poolPromise;
  poolPromise = undefined;
  await pool.close(10);
}

async function getStandaloneConnection() {
  validateDbConfig();

  return oracledb.getConnection({
    user: config.db.user,
    password: config.db.password,
    connectString: config.db.connectString,
  });
}

module.exports = {
  closePool,
  getConnection,
  getStandaloneConnection,
};
