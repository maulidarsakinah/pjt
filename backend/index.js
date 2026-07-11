const app = require("./src/app");
const config = require("./src/config");
const db = require("./src/db");
const logger = require("./src/logger");

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      oracleDriverMode: config.db.useThickMode ? "thick" : "thin",
    },
    "server_started"
  );
});

const shutdown = (signal) => {
  logger.info({ signal }, "server_shutdown_started");

  server.close(async (error) => {
    if (error) {
      logger.error({ err: error, error: error.message }, "server_shutdown_failed");
      process.exit(1);
    }

    try {
      await db.closePool();
    } catch (poolError) {
      logger.error(
        { err: poolError, error: poolError.message },
        "database_pool_close_failed"
      );
      process.exit(1);
    }

    logger.info("server_shutdown_complete");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
