const express = require("express");
const compression = require("compression");
const config = require("./config");
const {
  corsAllowlist,
  generalRateLimit,
  requireJsonBody,
  securityHeaders,
} = require("./middleware/security");
const requestLogger = require("./middleware/requestLogger");
const errorHandler = require("./middleware/errorHandler");
const authRoutes = require("./routes/auth");
const companiesRoutes = require("./routes/companies");
const healthRoutes = require("./routes/health");
const logsRoutes = require("./routes/logs");
const meRoutes = require("./routes/me");
const permissionsRoutes = require("./routes/permissions");
const rolesRoutes = require("./routes/roles");
const stationsRoutes = require("./routes/stations");
const usersRoutes = require("./routes/users");
const docsRoutes = require("./routes/docs");
const openapiSpec = require("./openapi");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", config.security.trustProxy);

app.use(requestLogger);
app.use(corsAllowlist);
app.use(securityHeaders);
app.use(compression());
app.use(generalRateLimit);
app.use(requireJsonBody);
app.use(express.json({ limit: config.security.bodyLimit }));

app.get("/", (req, res) => {
  res.redirect(302, config.security.docsEnabled ? "/api/docs" : "/api/health");
});

if (config.security.docsEnabled) {
  app.use("/api/docs", docsRoutes);
  app.get("/api/openapi.json", (req, res) => {
    res.json(openapiSpec);
  });
}

app.use("/api", authRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/logs", logsRoutes);
app.use("/api/companies", companiesRoutes);
app.use("/api/me", meRoutes);
app.use("/api/permissions", permissionsRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/stations", stationsRoutes);
app.use("/api/users", usersRoutes);

app.get("/health", (req, res) => {
  res.redirect(308, "/api/health");
});

app.get("/companies", (req, res) => {
  const query = req.url.includes("?")
    ? req.url.slice(req.url.indexOf("?"))
    : "";
  res.redirect(308, `/api/companies${query}`);
});

app.get("/stations/flow", (req, res) => {
  const query = req.url.includes("?")
    ? req.url.slice(req.url.indexOf("?"))
    : "";
  res.redirect(308, `/api/stations/flow${query}`);
});

app.use((req, res) => {
  res.status(404).json({
    error: "Route not found",
    code: "ROUTE_NOT_FOUND",
    trace_id: req.trace_id,
  });
});

app.use(errorHandler);

module.exports = app;
