const assert = require("node:assert/strict");
const config = require("../src/config");
const {
  corsAllowlist,
  requireJsonBody,
} = require("../src/middleware/security");

function createResponse() {
  const headers = new Map();

  return {
    body: null,
    headers,
    statusCode: 200,
    json(body) {
      this.body = body;
      return this;
    },
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
  };
}

const allowedOrigin = "https://frontend.example";
config.security.corsOrigins.push(allowedOrigin);

const corsResponse = createResponse();
let corsContinued = false;

corsAllowlist(
  {
    headers: { origin: allowedOrigin },
    method: "GET",
  },
  corsResponse,
  () => {
    corsContinued = true;
  },
);

assert.equal(corsContinued, true);
assert.equal(
  corsResponse.headers.get("access-control-allow-headers"),
  "Authorization, Content-Type, X-Request-Id, X-Trace-Id",
);
assert.equal(
  corsResponse.headers.get("access-control-allow-credentials"),
  "true",
);

config.security.corsOrigins.pop();

const jsonResponse = createResponse();
let jsonContinued = false;

requireJsonBody(
  {
    headers: { "content-length": "12" },
    is: () => false,
    trace_id: "tx-json-test",
  },
  jsonResponse,
  () => {
    jsonContinued = true;
  },
);

assert.equal(jsonContinued, false);
assert.equal(jsonResponse.statusCode, 415);
assert.equal(jsonResponse.body.code, "UNSUPPORTED_MEDIA_TYPE");

console.log("Security middleware tests passed");
