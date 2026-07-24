const assert = require("node:assert/strict");
const config = require("../src/config");
const {
  clearAuthCookie,
  getAuthToken,
  getCookieOptions,
  parseCookieHeader,
  setAuthCookie,
} = require("../src/authCookie");

const parsed = parseCookieHeader(
  "theme=dark; pkl_session=header.payload.signature; encoded=a%20b",
);

assert.deepEqual(parsed, {
  theme: "dark",
  pkl_session: "header.payload.signature",
  encoded: "a%20b",
});
assert.deepEqual(parseCookieHeader(undefined), {});
assert.equal(
  getAuthToken({
    headers: { cookie: `${config.auth.cookieName}=signed.jwt.value` },
  }),
  "signed.jwt.value",
);
assert.equal(getAuthToken({ headers: {} }), null);
assert.deepEqual(getCookieOptions(), {
  httpOnly: true,
  path: "/",
  sameSite: config.auth.cookieSameSite,
  secure: config.auth.cookieSecure,
});

const calls = [];
const response = {
  clearCookie(name, options) {
    calls.push({ action: "clear", name, options });
  },
  cookie(name, value, options) {
    calls.push({ action: "set", name, value, options });
  },
};

setAuthCookie(response, "signed.jwt.value");
clearAuthCookie(response);

assert.deepEqual(calls, [
  {
    action: "set",
    name: config.auth.cookieName,
    value: "signed.jwt.value",
    options: getCookieOptions(),
  },
  {
    action: "clear",
    name: config.auth.cookieName,
    options: getCookieOptions(),
  },
]);

console.log("Auth cookie tests passed");
