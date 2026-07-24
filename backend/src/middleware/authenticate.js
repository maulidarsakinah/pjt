const jwt = require("jsonwebtoken");
const config = require("../config");
const { getAuthToken } = require("../authCookie");
const { TtlCache } = require("../cache");
const db = require("../db");

const authUserCache = new TtlCache({
  name: "auth_user",
  ttlMs: config.cache.authTtlMs,
  maxItems: config.cache.authMaxItems,
});

function unauthorized(message = "authentication required") {
  const error = new Error(message);
  error.statusCode = 401;
  error.publicMessage = "Missing or invalid session";
  error.publicCode = "UNAUTHORIZED";
  return error;
}

async function findActiveUser(userId) {
  const cacheKey = `auth:user:${userId}`;
  const cachedUser = authUserCache.get(cacheKey);

  if (cachedUser) {
    return cachedUser;
  }

  let connection;

  try {
    connection = await db.getConnection();
    const result = await connection.execute(
      `SELECT
         "id" AS "id",
         "name" AS "name",
         "email" AS "email",
         "phone" AS "phone",
         "status" AS "status",
         "company_id" AS "company_id"
       FROM "users"
       WHERE "id" = :id
       AND "status" = '1'
       AND ROWNUM = 1`,
      { id: userId },
      {
        fetchArraySize: 1,
        maxRows: 1,
      },
    );

    const user = result.rows[0];

    if (user) {
      authUserCache.set(cacheKey, user);
    }

    return user;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = async (req, res, next) => {
  try {
    const token = getAuthToken(req);

    if (!token) {
      throw unauthorized();
    }

    let payload;

    try {
      payload = jwt.verify(token, config.auth.jwtSecret, {
        audience: config.auth.jwtAudience,
        issuer: config.auth.jwtIssuer,
      });
    } catch (error) {
      throw unauthorized("invalid or expired token");
    }

    const userId = Number(payload.sub);

    if (!Number.isInteger(userId) || userId <= 0) {
      throw unauthorized("invalid or expired token");
    }

    const user = await findActiveUser(userId);

    if (!user) {
      throw unauthorized("invalid or expired token");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports.invalidateUser = (userId) => {
  authUserCache.delete(`auth:user:${userId}`);
};

module.exports.clearCache = () => {
  authUserCache.clear();
};
