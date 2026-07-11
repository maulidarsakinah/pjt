const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const { getUserAccess, invalidateUserAccess } = require("../services/access");
const db = require("../db");
const { badRequest, notFound } = require("../utils/httpErrors");
const { buildListResponse, parsePagination } = require("../utils/pagination");
const { parsePositiveInteger } = require("../utils/validation");

const USER_MODEL_TYPE = "App\\Models\\User";

function forbidden(message = "forbidden") {
  const error = new Error(message);
  error.statusCode = 403;
  error.publicMessage = "Forbidden";
  return error;
}

function assertNotSelfAccessChange(req, targetUserId) {
  if (Number(req.user?.id) === targetUserId) {
    throw forbidden("users cannot modify their own access assignments");
  }
}

function logAccessAudit(req, action, targetUserId, details = {}) {
  req.log.info(
    {
      audit: true,
      actor_user_id: req.user?.id,
      target_user_id: targetUserId,
      action,
      ...details,
    },
    "access_admin_action"
  );
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

router.use(authenticate);

router.get("/accesses", requirePermission("list accesses"), async (req, res, next) => {
  let connection;

  try {
    const pagination = parsePagination(req.query);

    connection = await db.getConnection();
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

    res.json(buildListResponse(result.rows, pagination));
  } catch (error) {
    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.get("/:id/access", requirePermission("view accesses"), async (req, res, next) => {
  let connection;

  try {
    const userId = parsePositiveInteger(req.params.id);

    connection = await db.getConnection();

    if (!(await userExists(connection, userId))) {
      throw notFound("user not found");
    }

    const roles = await getAssignedRoles(connection, userId);
    const direct_permissions = await getAssignedDirectPermissions(connection, userId);
    const access = await getUserAccess(userId);

    res.json({
      user_id: userId,
      roles,
      direct_permissions,
      effective: access,
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.post("/:id/roles/:roleId", requirePermission("create accesses"), async (req, res, next) => {
  let connection;
  let shouldRollback = false;

  try {
    const userId = parsePositiveInteger(req.params.id);
    const roleId = parsePositiveInteger(req.params.roleId, "role_id");

    assertNotSelfAccessChange(req, userId);

    connection = await db.getConnection();
    shouldRollback = true;

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

    await connection.commit();
    shouldRollback = false;
    invalidateUserAccess(userId);
    logAccessAudit(req, "assign_user_role", userId, { role_id: roleId });

    const roles = await getAssignedRoles(connection, userId);

    res.status(201).json({
      data: roles,
      count: roles.length,
    });
  } catch (error) {
    if (connection && shouldRollback) {
      await connection.rollback();
    }

    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.delete("/:id/roles/:roleId", requirePermission("delete accesses"), async (req, res, next) => {
  let connection;
  let shouldRollback = false;

  try {
    const userId = parsePositiveInteger(req.params.id);
    const roleId = parsePositiveInteger(req.params.roleId, "role_id");

    assertNotSelfAccessChange(req, userId);

    connection = await db.getConnection();
    shouldRollback = true;

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

    await connection.commit();
    shouldRollback = false;
    invalidateUserAccess(userId);
    logAccessAudit(req, "remove_user_role", userId, { role_id: roleId });

    res.status(204).send();
  } catch (error) {
    if (connection && shouldRollback) {
      await connection.rollback();
    }

    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.put("/:id/roles", requirePermission("update accesses"), async (req, res, next) => {
  let connection;
  let shouldRollback = false;

  try {
    const userId = parsePositiveInteger(req.params.id);
    const roleIds = parseIds(req.body.role_ids, "role_ids");

    assertNotSelfAccessChange(req, userId);

    connection = await db.getConnection();
    shouldRollback = true;

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

    await connection.commit();
    shouldRollback = false;
    invalidateUserAccess(userId);
    logAccessAudit(req, "replace_user_roles", userId, { role_ids: roleIds });

    const roles = await getAssignedRoles(connection, userId);

    res.json({
      data: roles,
      count: roles.length,
    });
  } catch (error) {
    if (connection && shouldRollback) {
      await connection.rollback();
    }

    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.post("/:id/permissions/:permissionId", requirePermission("create accesses"), async (req, res, next) => {
  let connection;
  let shouldRollback = false;

  try {
    const userId = parsePositiveInteger(req.params.id);
    const permissionId = parsePositiveInteger(req.params.permissionId, "permission_id");

    assertNotSelfAccessChange(req, userId);

    connection = await db.getConnection();
    shouldRollback = true;

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

    await connection.commit();
    shouldRollback = false;
    invalidateUserAccess(userId);
    logAccessAudit(req, "assign_user_permission", userId, { permission_id: permissionId });

    const permissions = await getAssignedDirectPermissions(connection, userId);

    res.status(201).json({
      data: permissions,
      count: permissions.length,
    });
  } catch (error) {
    if (connection && shouldRollback) {
      await connection.rollback();
    }

    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.delete("/:id/permissions/:permissionId", requirePermission("delete accesses"), async (req, res, next) => {
  let connection;
  let shouldRollback = false;

  try {
    const userId = parsePositiveInteger(req.params.id);
    const permissionId = parsePositiveInteger(req.params.permissionId, "permission_id");

    assertNotSelfAccessChange(req, userId);

    connection = await db.getConnection();
    shouldRollback = true;

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

    await connection.commit();
    shouldRollback = false;
    invalidateUserAccess(userId);
    logAccessAudit(req, "remove_user_permission", userId, { permission_id: permissionId });

    res.status(204).send();
  } catch (error) {
    if (connection && shouldRollback) {
      await connection.rollback();
    }

    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.put("/:id/permissions", requirePermission("update accesses"), async (req, res, next) => {
  let connection;
  let shouldRollback = false;

  try {
    const userId = parsePositiveInteger(req.params.id);
    const permissionIds = parseIds(req.body.permission_ids, "permission_ids");

    assertNotSelfAccessChange(req, userId);

    connection = await db.getConnection();
    shouldRollback = true;

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

    await connection.commit();
    shouldRollback = false;
    invalidateUserAccess(userId);
    logAccessAudit(req, "replace_user_permissions", userId, { permission_ids: permissionIds });

    const permissions = await getAssignedDirectPermissions(connection, userId);

    res.json({
      data: permissions,
      count: permissions.length,
    });
  } catch (error) {
    if (connection && shouldRollback) {
      await connection.rollback();
    }

    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

module.exports = router;
