const jwt = require("jsonwebtoken");
const config = require("./config");

function getBearerToken(req) {
  const authorization = req.headers.authorization;

  if (typeof authorization !== "string") {
    return null;
  }

  const match = authorization.match(/^Bearer[ \t]+(\S+)$/i);

  return match ? match[1] : null;
}

function verifyAccessToken(token) {
  const payload = jwt.verify(token, config.auth.jwtSecret, {
    algorithms: ["HS256"],
    audience: config.auth.jwtAudience,
    issuer: config.auth.jwtIssuer,
  });

  if (payload.token_type !== undefined && payload.token_type !== "access") {
    throw new jwt.JsonWebTokenError("invalid token type");
  }

  return payload;
}

module.exports = {
  getBearerToken,
  verifyAccessToken,
};
