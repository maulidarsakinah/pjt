const config = require("../config");
const { TtlCache } = require("../cache");
const db = require("../db");

const USER_MODEL_TYPE = "App\\Models\\User";

const accessCache = new TtlCache({
  name: "user_access",
  ttlMs: config.cache.authTtlMs,
  maxItems: config.cache.authMaxItems,
});

async function getUserRoles(connection, userId) {
  const result = await connection.execute(
    `SELECT DISTINCT
       r."name" AS "name"
     FROM "roles" r
     INNER JOIN "model_has_roles" mhr
       ON mhr."role_id" = r."id"
     WHERE mhr."model_id" = :user_id
     AND mhr."model_type" = :model_type
     ORDER BY r."name" ASC`,
    {
      user_id: userId,
      model_type: USER_MODEL_TYPE,
    }
  );

  return result.rows.map((role) => role.name);
}

async function getUserPermissions(connection, userId) {
  const result = await connection.execute(
    `SELECT "name"
     FROM (
       SELECT p."name" AS "name"
       FROM "permissions" p
       INNER JOIN "role_has_permissions" rhp
         ON rhp."permission_id" = p."id"
       INNER JOIN "model_has_roles" mhr
         ON mhr."role_id" = rhp."role_id"
       WHERE mhr."model_id" = :user_id
       AND mhr."model_type" = :model_type
       UNION
       SELECT p."name" AS "name"
       FROM "permissions" p
       INNER JOIN "model_has_permissions" mhp
         ON mhp."permission_id" = p."id"
       WHERE mhp."model_id" = :user_id
       AND mhp."model_type" = :model_type
     )
     ORDER BY "name" ASC`,
    {
      user_id: userId,
      model_type: USER_MODEL_TYPE,
    }
  );

  return result.rows.map((permission) => permission.name);
}

async function getUserAccess(userId) {
  const cacheKey = `access:user:${userId}`;
  const cachedAccess = accessCache.get(cacheKey);

  if (cachedAccess) {
    return cachedAccess;
  }

  let connection;

  try {
    connection = await db.getConnection();
    const roles = await getUserRoles(connection, userId);
    const permissions = await getUserPermissions(connection, userId);
    const access = { roles, permissions };

    accessCache.set(cacheKey, access);
    return access;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

function clearAccessCache() {
  accessCache.clear();
}

function invalidateUserAccess(userId) {
  accessCache.delete(`access:user:${userId}`);
}

module.exports = {
  clearAccessCache,
  getUserAccess,
  invalidateUserAccess,
};
