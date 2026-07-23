const pino = require("pino");
const config = require("./config");

const loggerOptions = {
  level: process.env.LOG_LEVEL || "info",
  messageKey: "message",
  formatters: {
    level: (label) => ({
      level: label,
    }),
  },
  base: {
    service: process.env.SERVICE_NAME || "pkl-api",
    env: config.nodeEnv,
  },
  redact: {
    paths: [
      "authorization",
      "cookie",
      "password",
      "token",
      "jwt",
      "secret",
      "headers.authorization",
      "headers.cookie",
      "body.password",
      "body.token",
      "body.jwt",
      "body.secret",
      "metadata.password",
      "metadata.token",
      "metadata.jwt",
      "metadata.secret",
      "req.headers.authorization",
      "req.headers.cookie",
      "req.body.password",
      "req.body.token",
      "req.body.jwt",
      "req.body.secret",
      "db.password",
      "DB_PASSWORD",
      "JWT_SECRET",
    ],
    censor: "[REDACTED]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

const streams = [
  {
    stream: process.stdout,
  },
];

if (config.logging.fileEnabled) {
  streams.push({
    stream: pino.transport({
      target: "pino-roll",
      options: {
        file: config.logging.filePath,
        frequency: "daily",
        dateFormat: "dd-MM-yy",
        mkdir: true,
        extension: ".log",
        limit: {
          count: config.logging.retentionCount,
          removeOtherLogFiles: false,
        },
      },
    }),
  });
}

const logger = pino(loggerOptions, pino.multistream(streams));

module.exports = logger;
