const config = require("./config");

const revokedTokenIds = new Map();
const invalidatedUsers = new Map();

function evictOverflow(items) {
  while (items.size > config.auth.revocationMaxItems) {
    items.delete(items.keys().next().value);
  }
}

function removeExpiredTokens(now = Date.now()) {
  for (const [tokenId, expiresAt] of revokedTokenIds) {
    if (expiresAt <= now) {
      revokedTokenIds.delete(tokenId);
    }
  }
}

function revokeToken(payload) {
  const expiresAt = Number(payload?.exp) * 1000;
  const tokenId = payload?.jti;

  if (typeof tokenId !== "string" || !Number.isFinite(expiresAt)) {
    return;
  }

  removeExpiredTokens();
  revokedTokenIds.set(tokenId, expiresAt);
  evictOverflow(revokedTokenIds);
}

function revokeUserTokens(userId) {
  invalidatedUsers.delete(String(userId));
  invalidatedUsers.set(String(userId), Date.now());
  evictOverflow(invalidatedUsers);
}

function isTokenRevoked(payload) {
  removeExpiredTokens();

  if (revokedTokenIds.has(payload?.jti)) {
    return true;
  }

  const invalidatedAt = invalidatedUsers.get(String(payload?.sub));

  if (invalidatedAt === undefined) {
    return false;
  }

  const issuedAt = Number(payload?.issued_at_ms);

  return !Number.isFinite(issuedAt) || issuedAt <= invalidatedAt;
}

function clearTokenRevocations() {
  revokedTokenIds.clear();
  invalidatedUsers.clear();
}

module.exports = {
  clearTokenRevocations,
  isTokenRevoked,
  revokeToken,
  revokeUserTokens,
};
