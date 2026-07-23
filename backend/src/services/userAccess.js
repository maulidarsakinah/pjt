const { getUserAccess, invalidateUserAccess } = require("./access");
const { writeAuditEvent } = require("./audit");
const { withConnection, withTransaction } = require("./database");
const { badRequest, notFound } = require("../utils/httpErrors");
const { parsePositiveInteger } = require("../utils/validation");

const USER_MODEL_TYPE = "App\\Models\\User";

function forbidden(message = "forbidden") {
  const error = new Error(message);

  error.statusCode = 403;
  error.publicMessage = "Forbidden";
  return error;
}

function assertNotSelfAccessChange(actorUserId, targetUserId) {
  if (Number(actorUserId) === targetUserId) {
    throw forbidden("users cannot modify their own access assignments");
  }
}

function logAccessAudit(req, action, targetUserId, details = {}) {
  writeAuditEvent(req, {
    category: "access_admin",
    action,
    targetType: "user",
    targetId: targetUserId,
    metadata: details,
  });
}

function parseIds(value, field) {
  if (!Array.isArray(value)) {
    throw badRequest(`${field} must be an array`);
  }

  return [...new Set(value.map((id) => parsePositiveInteger(id, field.slice(0, -1))))];
}

async function userExists(connection, userId) {
  const result = await connection.execute(
    `SELECT "id" AS "id"
     FROM "users"
     WHERE "id" = :id
     AND ROWNUM = 1`,
    { id: userId },
    {
      fetchArraySize: 1,
      maxRows: 1,
    }
  );

  return result.rows.length > 0;
}

async function assertIdsExist(connection, tableName, ids, field) {
  if (ids.length === 0) {
    return;
  }

  const binds = {};
  const placeholders = ids.map((id, index) => {
    const key = `id${index}`;

    binds[key] = id;
    return `:${key}`;
  });

  const result = await connection.execute(
    `SELECT "id" AS "id"
     FROM "${tableName}"
     WHERE "id" IN (${placeholders.join(", ")})`,
    binds
  );
  const foundIds = new Set(result.rows.map((row) => row.id));
  const missingIds = ids.filter((id) => !foundIds.has(id));

  if (missingIds.length > 0) {
    throw badRequest(`${field} not found: ${missingIds.join(", ")}`);
  }
}

async function getAssignedRoles(connection, userId) {
  const result = await connection.execute(
    `SELECT
       r."id" AS "id",
       r."name" AS "name",
       r."guard_name" AS "guard_name"
     FROM "roles" r
     INNER JOIN "model_has_roles" mhr
       ON mhr."role_id" = r."id"
     WHERE mhr."model_id" = :user_id
     AND mhr."model_type" = :model_type
     ORDER BY r."id" ASC`,
    {
      user_id: userId,
      model_type: USER_MODEL_TYPE,
    }
  );

  return result.rows;
}

async function getAssignedDirectPermissions(connection, userId) {
  const result = await connection.execute(
    `SELECT
       p."id" AS "id",
       p."name" AS "name",
       p."guard_name" AS "guard_name"
     FROM "permissions" p
     INNER JOIN "model_has_permissions" mhp
       ON mhp."permission_id" = p."id"
     WHERE mhp."model_id" = :user_id
     AND mhp."model_type" = :model_type
     ORDER BY p."id" ASC`,
    {
      user_id: userId,
      model_type: USER_MODEL_TYPE,
    }
  );

  return result.rows;
}

async function listUserAccesses(pagination) {
  return withConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT
         "user_id",
         "user_name",
         "email",
         "role_id",
         "role_name"
       FROM (
         SELECT page_query.*, ROWNUM AS "rn"
         FROM (
           SELECT
             u."id" AS "user_id",
             u."name" AS "user_name",
             u."email" AS "email",
             r."id" AS "role_id",
             r."name" AS "role_name"
           FROM "users" u
           LEFT JOIN "model_has_roles" mhr
             ON mhr."model_id" = u."id"
            AND mhr."model_type" = :model_type
           LEFT JOIN "roles" r
             ON r."id" = mhr."role_id"
           ORDER BY u."id" ASC, r."id" ASC
         ) page_query
         WHERE ROWNUM <= :page_end
       )
       WHERE "rn" > :offset`,
      {
        model_type: USER_MODEL_TYPE,
        page_end: pagination.pageEnd,
        offset: pagination.offset,
      },
      {
        fetchArraySize: Math.min(pagination.limit + 1, 100),
        maxRows: pagination.limit + 1,
      }
    );

    return result.rows;
  });
}

async function getUserAccessDetails(userId) {
  return withConnection(async (connection) => {
    if (!(await userExists(connection, userId))) {
      throw notFound("user not found");
    }

    const roles = await getAssignedRoles(connection, userId);
    const direct_permissions = await getAssignedDirectPermissions(connection, userId);
    const access = await getUserAccess(userId);

    return {
      user_id: userId,
      roles,
      direct_permissions,
      effective: access,
    };
  });
}

async function assignUserRole(actorUserId, userId, roleId, req) {
  assertNotSelfAccessChange(actorUserId, userId);
  const roles = await withTransaction(async (connection) => {
    if (!(await userExists(connection, userId))) {
      throw notFound("user not found");
    }

    await assertIdsExist(connection, "roles", [roleId], "role_id");

    await connection.execute(
      `DELETE FROM "model_has_roles"
       WHERE "model_id" = :user_id
       AND "model_type" = :model_type
       AND "role_id" = :role_id`,
      {
        user_id: userId,
        model_type: USER_MODEL_TYPE,
        role_id: roleId,
      }
    );
    await connection.execute(
      `INSERT INTO "model_has_roles" (
         "role_id",
         "model_type",
         "model_id"
       ) VALUES (
         :role_id,
         :model_type,
         :user_id
       )`,
      {
        role_id: roleId,
        model_type: USER_MODEL_TYPE,
        user_id: userId,
      }
    );

    return getAssignedRoles(connection, userId);
  });

  invalidateUserAccess(userId);
  logAccessAudit(req, "assign_user_role", userId, { role_id: roleId });
  return roles;
}

async function removeUserRole(actorUserId, userId, roleId, req) {
  assertNotSelfAccessChange(actorUserId, userId);

  await withTransaction(async (connection) => {
    const result = await connection.execute(
      `DELETE FROM "model_has_roles"
       WHERE "model_id" = :user_id
       AND "model_type" = :model_type
       AND "role_id" = :role_id`,
      {
        user_id: userId,
        model_type: USER_MODEL_TYPE,
        role_id: roleId,
      }
    );

    if (result.rowsAffected === 0) {
      throw notFound("role assignment not found");
    }
  });

  invalidateUserAccess(userId);
  logAccessAudit(req, "remove_user_role", userId, { role_id: roleId });
}

async function replaceUserRoles(actorUserId, userId, roleIdsValue, req) {
  assertNotSelfAccessChange(actorUserId, userId);

  const roleIds = parseIds(roleIdsValue, "role_ids");
  const roles = await withTransaction(async (connection) => {
    if (!(await userExists(connection, userId))) {
      throw notFound("user not found");
    }

    await assertIdsExist(connection, "roles", roleIds, "role_ids");

    await connection.execute(
      `DELETE FROM "model_has_roles"
       WHERE "model_id" = :user_id
       AND "model_type" = :model_type`,
      {
        user_id: userId,
        model_type: USER_MODEL_TYPE,
      }
    );

    for (const roleId of roleIds) {
      await connection.execute(
        `INSERT INTO "model_has_roles" (
           "role_id",
           "model_type",
           "model_id"
         ) VALUES (
           :role_id,
           :model_type,
           :user_id
         )`,
        {
          role_id: roleId,
          model_type: USER_MODEL_TYPE,
          user_id: userId,
        }
      );
    }

    return getAssignedRoles(connection, userId);
  });

  invalidateUserAccess(userId);
  logAccessAudit(req, "replace_user_roles", userId, { role_ids: roleIds });
  return roles;
}

async function assignUserPermission(actorUserId, userId, permissionId, req) {
  assertNotSelfAccessChange(actorUserId, userId);
  const permissions = await withTransaction(async (connection) => {
    if (!(await userExists(connection, userId))) {
      throw notFound("user not found");
    }

    await assertIdsExist(connection, "permissions", [permissionId], "permission_id");

    await connection.execute(
      `DELETE FROM "model_has_permissions"
       WHERE "model_id" = :user_id
       AND "model_type" = :model_type
       AND "permission_id" = :permission_id`,
      {
        user_id: userId,
        model_type: USER_MODEL_TYPE,
        permission_id: permissionId,
      }
    );
    await connection.execute(
      `INSERT INTO "model_has_permissions" (
         "permission_id",
         "model_type",
         "model_id"
       ) VALUES (
         :permission_id,
         :model_type,
         :user_id
       )`,
      {
        permission_id: permissionId,
        model_type: USER_MODEL_TYPE,
        user_id: userId,
      }
    );

    return getAssignedDirectPermissions(connection, userId);
  });

  invalidateUserAccess(userId);
  logAccessAudit(req, "assign_user_permission", userId, { permission_id: permissionId });
  return permissions;
}

async function removeUserPermission(actorUserId, userId, permissionId, req) {
  assertNotSelfAccessChange(actorUserId, userId);

  await withTransaction(async (connection) => {
    const result = await connection.execute(
      `DELETE FROM "model_has_permissions"
       WHERE "model_id" = :user_id
       AND "model_type" = :model_type
       AND "permission_id" = :permission_id`,
      {
        user_id: userId,
        model_type: USER_MODEL_TYPE,
        permission_id: permissionId,
      }
    );

    if (result.rowsAffected === 0) {
      throw notFound("permission assignment not found");
    }
  });

  invalidateUserAccess(userId);
  logAccessAudit(req, "remove_user_permission", userId, { permission_id: permissionId });
}

async function replaceUserPermissions(actorUserId, userId, permissionIdsValue, req) {
  assertNotSelfAccessChange(actorUserId, userId);

  const permissionIds = parseIds(permissionIdsValue, "permission_ids");
  const permissions = await withTransaction(async (connection) => {
    if (!(await userExists(connection, userId))) {
      throw notFound("user not found");
    }

    await assertIdsExist(connection, "permissions", permissionIds, "permission_ids");

    await connection.execute(
      `DELETE FROM "model_has_permissions"
       WHERE "model_id" = :user_id
       AND "model_type" = :model_type`,
      {
        user_id: userId,
        model_type: USER_MODEL_TYPE,
      }
    );

    for (const permissionId of permissionIds) {
      await connection.execute(
        `INSERT INTO "model_has_permissions" (
           "permission_id",
           "model_type",
           "model_id"
         ) VALUES (
           :permission_id,
           :model_type,
           :user_id
         )`,
        {
          permission_id: permissionId,
          model_type: USER_MODEL_TYPE,
          user_id: userId,
        }
      );
    }

    return getAssignedDirectPermissions(connection, userId);
  });

  invalidateUserAccess(userId);
  logAccessAudit(req, "replace_user_permissions", userId, {
    permission_ids: permissionIds,
  });
  return permissions;
}

module.exports = {
  assignUserPermission,
  assignUserRole,
  getUserAccessDetails,
  listUserAccesses,
  removeUserPermission,
  removeUserRole,
  replaceUserPermissions,
  replaceUserRoles,
};
