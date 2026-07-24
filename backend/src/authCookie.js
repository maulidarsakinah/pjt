const config = require("./config");

function parseCookieHeader(header) {
  if (typeof header !== "string" || header.length === 0) {
    return {};
  }

  return header.split(";").reduce((cookies, part) => {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex <= 0) {
      return cookies;
    }

    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();

    if (name && !Object.hasOwn(cookies, name)) {
      cookies[name] = value;
    }

    return cookies;
  }, {});
}

function getAuthToken(req) {
  const cookies = parseCookieHeader(req.headers.cookie);
  return cookies[config.auth.cookieName] || null;
}

function getCookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    sameSite: config.auth.cookieSameSite,
    secure: config.auth.cookieSecure,
  };
}

function setAuthCookie(res, token) {
  res.cookie(config.auth.cookieName, token, getCookieOptions());
}

function clearAuthCookie(res) {
  res.clearCookie(config.auth.cookieName, getCookieOptions());
}

module.exports = {
  clearAuthCookie,
  getAuthToken,
  getCookieOptions,
  parseCookieHeader,
  setAuthCookie,
};
