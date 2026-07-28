const assert = require("node:assert/strict");
const {
  clearTokenRevocations,
  isTokenRevoked,
  revokeToken,
  revokeUserTokens,
} = require("../src/tokenRevocation");

const now = Date.now();
const activeToken = {
  exp: Math.ceil(now / 1000) + 900,
  issued_at_ms: now,
  jti: "active-token",
  sub: "1",
};

clearTokenRevocations();
assert.equal(isTokenRevoked(activeToken), false);

revokeToken(activeToken);
assert.equal(isTokenRevoked(activeToken), true);

const priorToken = {
  ...activeToken,
  issued_at_ms: now - 1000,
  jti: "prior-token",
};
const laterToken = {
  ...activeToken,
  issued_at_ms: now + 1000,
  jti: "later-token",
};

revokeUserTokens(1);
assert.equal(isTokenRevoked(priorToken), true);
assert.equal(isTokenRevoked(laterToken), false);

clearTokenRevocations();
console.log("Token revocation tests passed");
