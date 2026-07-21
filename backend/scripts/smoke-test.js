const app = require("../src/app");

async function requestJson(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();

  return {
    body,
    response,
  };
}

async function main() {
  const server = app.listen(0);

  await new Promise((resolve) => {
    server.once("listening", resolve);
  });

  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const health = await requestJson(baseUrl, "/api/health", {
      headers: {
        "x-trace-id": "tx-ci-health",
      },
    });

    if (health.response.status !== 200 || health.body.status !== "ok") {
      throw new Error(`Expected /api/health to return 200 ok, got ${health.response.status}`);
    }

    const invalidRegistration = await requestJson(baseUrl, "/api/register", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-trace-id": "tx-ci-register-invalid",
      },
      body: JSON.stringify({}),
    });

    if (invalidRegistration.response.status !== 400) {
      throw new Error(
        `Expected malformed /api/register to return 400, got ${invalidRegistration.response.status}`
      );
    }

    const invalidLogin = await requestJson(baseUrl, "/api/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-trace-id": "tx-ci-login-invalid",
      },
      body: JSON.stringify({}),
    });

    if (invalidLogin.response.status !== 400) {
      throw new Error(`Expected malformed /api/login to return 400, got ${invalidLogin.response.status}`);
    }

    const companies = await requestJson(baseUrl, "/api/companies", {
      headers: {
        "x-trace-id": "tx-ci-companies",
      },
    });

    if (companies.response.status !== 401) {
      throw new Error(`Expected /api/companies without token to return 401, got ${companies.response.status}`);
    }

    if (!companies.body.trace_id) {
      throw new Error("Expected /api/companies error response to include trace_id");
    }

    if (companies.body.error !== "Missing or invalid token" || companies.body.code !== "UNAUTHORIZED") {
      throw new Error("Expected /api/companies 401 body to include Missing or invalid token and UNAUTHORIZED");
    }

    const meAccess = await requestJson(baseUrl, "/api/me/access", {
      headers: {
        "x-trace-id": "tx-ci-me-access",
      },
    });

    if (meAccess.response.status !== 401) {
      throw new Error(`Expected /api/me/access without token to return 401, got ${meAccess.response.status}`);
    }

    if (!meAccess.body.trace_id) {
      throw new Error("Expected /api/me/access error response to include trace_id");
    }

    if (meAccess.body.error !== "Missing or invalid token" || meAccess.body.code !== "UNAUTHORIZED") {
      throw new Error("Expected /api/me/access 401 body to include Missing or invalid token and UNAUTHORIZED");
    }

    const roles = await requestJson(baseUrl, "/api/roles", {
      headers: {
        "x-trace-id": "tx-ci-roles",
      },
    });

    if (roles.response.status !== 401) {
      throw new Error(`Expected /api/roles without token to return 401, got ${roles.response.status}`);
    }

    const permissions = await requestJson(baseUrl, "/api/permissions", {
      headers: {
        "x-trace-id": "tx-ci-permissions",
      },
    });

    if (permissions.response.status !== 401) {
      throw new Error(`Expected /api/permissions without token to return 401, got ${permissions.response.status}`);
    }

    const userAccess = await requestJson(baseUrl, "/api/users/1/access", {
      headers: {
        "x-trace-id": "tx-ci-user-access",
      },
    });

    if (userAccess.response.status !== 401) {
      throw new Error(`Expected /api/users/1/access without token to return 401, got ${userAccess.response.status}`);
    }

    const accesses = await requestJson(baseUrl, "/api/users/accesses", {
      headers: {
        "x-trace-id": "tx-ci-accesses",
      },
    });

    if (accesses.response.status !== 401) {
      throw new Error(`Expected /api/users/accesses without token to return 401, got ${accesses.response.status}`);
    }

    const logs = await requestJson(baseUrl, "/api/logs", {
      headers: {
        "x-trace-id": "tx-ci-logs",
      },
    });

    if (logs.response.status !== 401) {
      throw new Error(`Expected /api/logs without token to return 401, got ${logs.response.status}`);
    }

    if (!logs.body.trace_id) {
      throw new Error("Expected /api/logs error response to include trace_id");
    }

    const stations = await requestJson(baseUrl, "/api/stations/flow", {
      headers: {
        "x-trace-id": "tx-ci-stations-flow",
      },
    });

    if (stations.response.status !== 401) {
      throw new Error(`Expected /api/stations/flow without token to return 401, got ${stations.response.status}`);
    }

    if (!stations.body.trace_id) {
      throw new Error("Expected /api/stations/flow error response to include trace_id");
    }

    const stationData = await requestJson(baseUrl, "/api/stations/flow/740/data", {
      headers: {
        "x-trace-id": "tx-ci-stations-flow-data",
      },
    });

    if (stationData.response.status !== 401) {
      throw new Error(`Expected /api/stations/flow/740/data without token to return 401, got ${stationData.response.status}`);
    }

    if (!stationData.body.trace_id) {
      throw new Error("Expected /api/stations/flow/740/data error response to include trace_id");
    }

    const openapi = await requestJson(baseUrl, "/api/openapi.json", {
      headers: {
        "x-trace-id": "tx-ci-openapi",
      },
    });

    if (openapi.response.status !== 200 || openapi.body.openapi !== "3.0.3") {
      throw new Error(`Expected /api/openapi.json to return OpenAPI 3.0.3, got ${openapi.response.status}`);
    }

    console.log("Smoke tests passed");
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
