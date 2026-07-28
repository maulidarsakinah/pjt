function getBearerToken(req) {
  const authorization = req.headers.authorization;

  if (typeof authorization !== "string") {
    return null;
  }

  const match = authorization.match(/^Bearer[ \t]+(\S+)$/i);

  return match ? match[1] : null;
}

module.exports = {
  getBearerToken,
};
