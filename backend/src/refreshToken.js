const { randomUUID } = require("node:crypto");
const jwt = require("jsonwebtoken");
const config = require("./config");

function createRefreshToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      token_type: "refresh",
      issued_at_ms: Date.now(),
    },
    config.auth.refreshTokenSecret,
    {
      expiresIn: config.auth.refreshTokenTtlSeconds,
      issuer: config.auth.jwtIssuer,
      audience: config.auth.refreshTokenAudience,
      algorithm: "HS256",
      jwtid: randomUUID(),
    },
  );
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, config.auth.refreshTokenSecret, {
    algorithms: ["HS256"],
    audience: config.auth.refreshTokenAudience,
    issuer: config.auth.jwtIssuer,
  });

  if (payload.token_type !== "refresh") {
    throw new jwt.JsonWebTokenError("invalid token type");
  }

  return payload;
}

function parseCookies(cookieHeader) {
  if (typeof cookieHeader !== "string" || !cookieHeader) {
    return {};
  }

  return cookieHeader.split(";").reduce((cookies, part) => {
    const separatorIndex = part.indexOf("=");

    if (separatorIndex <= 0) {
      return cookies;
    }

    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();

    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }

    return cookies;
  }, Object.create(null));
}

function getRefreshToken(req) {
  return parseCookies(req.headers.cookie)[config.auth.refreshCookieName] || null;
}

function refreshCookieOptions() {
  return {
    httpOnly: true,
    maxAge: config.auth.refreshTokenTtlSeconds * 1000,
    path: "/api",
    sameSite: "strict",
    secure: config.auth.refreshCookieSecure,
  };
}

function setRefreshCookie(res, token) {
  res.cookie(config.auth.refreshCookieName, token, refreshCookieOptions());
}

function clearRefreshCookie(res) {
  const { maxAge, ...options } = refreshCookieOptions();

  res.clearCookie(config.auth.refreshCookieName, options);
}

module.exports = {
  clearRefreshCookie,
  createRefreshToken,
  getRefreshToken,
  parseCookies,
  setRefreshCookie,
  verifyRefreshToken,
};
