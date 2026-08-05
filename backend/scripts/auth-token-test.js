const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const config = require("../src/config");
const { getBearerToken, verifyAccessToken } = require("../src/authToken");
const {
  createRefreshToken,
  clearRefreshCookie,
  parseCookies,
  setRefreshCookie,
  verifyRefreshToken,
} = require("../src/refreshToken");
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
assert.equal(getBearerToken({ headers: { authorization: "Bearer" } }), null);

const signedToken = createToken({
  id: 1,
  email: "user@example.com",
  company_id: 1,
});
const decodedToken = jwt.decode(signedToken, { complete: true });

assert.equal(decodedToken.header.alg, "HS256");
assert.equal(typeof decodedToken.payload.jti, "string");
assert.equal(typeof decodedToken.payload.issued_at_ms, "number");
assert.equal(decodedToken.payload.token_type, "access");
assert.doesNotThrow(() => {
  jwt.verify(signedToken, config.auth.jwtSecret, {
    algorithms: ["HS256"],
    audience: config.auth.jwtAudience,
    issuer: config.auth.jwtIssuer,
  });
});

const refreshToken = createRefreshToken({
  id: 1,
});
const refreshPayload = verifyRefreshToken(refreshToken);

assert.equal(refreshPayload.sub, "1");
assert.equal(refreshPayload.token_type, "refresh");
assert.throws(() => verifyAccessToken(refreshToken));
const parsedCookies = parseCookies(
  `theme=dark; ${config.auth.refreshCookieName}=${refreshToken}`,
);

assert.equal(parsedCookies.theme, "dark");
assert.equal(parsedCookies[config.auth.refreshCookieName], refreshToken);

const cookieCalls = [];
const cookieResponse = {
  clearCookie(name, options) {
    cookieCalls.push({ action: "clear", name, options });
  },
  cookie(name, value, options) {
    cookieCalls.push({ action: "set", name, options, value });
  },
};

setRefreshCookie(cookieResponse, refreshToken);
clearRefreshCookie(cookieResponse);

assert.equal(cookieCalls[0].name, config.auth.refreshCookieName);
assert.equal(cookieCalls[0].value, refreshToken);
assert.equal(cookieCalls[0].options.httpOnly, true);
assert.equal(cookieCalls[0].options.sameSite, "strict");
assert.equal(cookieCalls[0].options.path, "/api");
assert.equal(cookieCalls[0].options.secure, config.auth.refreshCookieSecure);
assert.equal(cookieCalls[1].action, "clear");
assert.equal(cookieCalls[1].options.maxAge, undefined);

console.log("Auth token tests passed");
