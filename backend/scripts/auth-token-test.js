const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const config = require("../src/config");
const { getBearerToken } = require("../src/authToken");
const { createToken } = require("../src/services/auth");

assert.equal(
  getBearerToken({
    headers: { authorization: "Bearer header.payload.signature" },
  }),
  "header.payload.signature",
);
assert.equal(
  getBearerToken({
    headers: { authorization: "bearer header.payload.signature" },
  }),
  "header.payload.signature",
);
assert.equal(getBearerToken({ headers: {} }), null);
assert.equal(
  getBearerToken({ headers: { authorization: "Basic credentials" } }),
  null,
);
assert.equal(
  getBearerToken({ headers: { authorization: "Bearer token extra" } }),
  null,
);
assert.equal(
  getBearerToken({ headers: { authorization: "Bearer" } }),
  null,
);

const signedToken = createToken({
  id: 1,
  email: "user@example.com",
  company_id: 1,
});
const decodedToken = jwt.decode(signedToken, { complete: true });

assert.equal(decodedToken.header.alg, "HS256");
assert.equal(typeof decodedToken.payload.jti, "string");
assert.equal(typeof decodedToken.payload.issued_at_ms, "number");
assert.doesNotThrow(() => {
  jwt.verify(signedToken, config.auth.jwtSecret, {
    algorithms: ["HS256"],
    audience: config.auth.jwtAudience,
    issuer: config.auth.jwtIssuer,
  });
});

console.log("Auth token tests passed");
