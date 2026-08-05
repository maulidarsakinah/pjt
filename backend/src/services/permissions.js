const { clearAccessCache } = require("./access");
const { buildFieldChanges, writeAuditEvent } = require("./audit");
const { withConnection, withTransaction } = require("./database");
const { badRequest, notFound } = require("../utils/httpErrors");
const { requiredString } = require("../utils/validation");

function logPermissionAudit(req, action, permissionId, details = {}) {
  writeAuditEvent(req, {
    category: "access_admin",
    action,
    targetType: "permission",
    targetId: permissionId,
    metadata: details,
  });
}

function validatePermissionPayload(body, { partial = false } = {}) {
  const payload = {};

  if (!partial || body.name !== undefined) {
    payload.name = requiredString(body.name, "name");
  }

  if (body.guard_name !== undefined) {
    payload.guard_name = requiredString(body.guard_name, "guard_name");
  } else if (!partial) {
    payload.guard_name = "web";
  }

  if (partial && Object.keys(payload).length === 0) {
    throw badRequest("at least one of name or guard_name is required");
  }

  return payload;
}

async function getPermissionById(connection, id) {
  const result = await connection.execute(
    `SELECT
       "id" AS "id",
       "name" AS "name",
       "guard_name" AS "guard_name",
       "created_at" AS "created_at",
       "updated_at" AS "updated_at"
     FROM "permissions"
     WHERE "id" = :id
     AND ROWNUM = 1`,
    { id },
    {
      fetchArraySize: 1,
      maxRows: 1,
    },
  );

  return result.rows[0];
}

async function listPermissions(pagination) {
  return withConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT
         "id",
         "name",
         "guard_name",
         "created_at",
         "updated_at"
       FROM (
         SELECT page_query.*, ROWNUM AS "rn"
         FROM (
           SELECT
             "id" AS "id",
             "name" AS "name",
             "guard_name" AS "guard_name",
             "created_at" AS "created_at",
             "updated_at" AS "updated_at"
           FROM "permissions"
           ORDER BY "id" ASC
         ) page_query
         WHERE ROWNUM <= :page_end
       )
       WHERE "rn" > :offset`,
      {
        page_end: pagination.pageEnd,
        offset: pagination.offset,
      },
      {
        fetchArraySize: Math.min(pagination.limit + 1, 100),
        maxRows: pagination.limit + 1,
      },
    );

    return result.rows;
  });
}

async function findPermission(id) {
  return withConnection((connection) => getPermissionById(connection, id));
}

async function createPermission(body, req) {
  const payload = validatePermissionPayload(body);
  const result = await withTransaction(async (connection) => {
    await connection.execute(`LOCK TABLE "permissions" IN EXCLUSIVE MODE`);

    const idResult = await connection.execute(
      `SELECT NVL(MAX("id"), 0) + 1 AS "next_id"
       FROM "permissions"`,
    );
    const nextId = idResult.rows[0].next_id;

    await connection.execute(
      `INSERT INTO "permissions" (
         "id",
         "name",
         "guard_name",
         "created_at",
         "updated_at"
       ) VALUES (
         :id,
         :name,
         :guard_name,
         SYSTIMESTAMP,
         SYSTIMESTAMP
       )`,
      {
        id: nextId,
        name: payload.name,
        guard_name: payload.guard_name,
      },
    );

    return {
      permission: await getPermissionById(connection, nextId),
      permissionId: nextId,
      name: payload.name,
    };
  });

  clearAccessCache();
  logPermissionAudit(req, "create_permission", result.permissionId, {
    name: result.name,
  });
  return result.permission;
}

async function updatePermission(id, body, req, { partial = true } = {}) {
  const payload = validatePermissionPayload(body, { partial });
  const result = await withTransaction(async (connection) => {
    const before = await getPermissionById(connection, id);

    if (!before) {
      throw notFound("permission not found");
    }

    const setClauses = Object.keys(payload).map(
      (field) => `"${field}" = :${field}`,
    );

    setClauses.push(`"updated_at" = SYSTIMESTAMP`);

    const result = await connection.execute(
      `UPDATE "permissions"
       SET ${setClauses.join(", ")}
       WHERE "id" = :id`,
      {
        ...payload,
        id,
      },
    );

    if (result.rowsAffected === 0) {
      throw notFound("permission not found");
    }

    return {
      permission: await getPermissionById(connection, id),
      before,
      fields: Object.keys(payload),
    };
  });

  clearAccessCache();
  writeAuditEvent(req, {
    category: "access_admin",
    action: "update_permission",
    targetType: "permission",
    targetId: id,
    changes: buildFieldChanges(
      result.before,
      result.permission,
      result.fields,
      {
        targetType: "permission",
      },
    ),
    metadata: { fields: result.fields },
  });
  return result.permission;
}

async function deletePermission(id, req) {
  await withTransaction(async (connection) => {
    await connection.execute(
      `DELETE FROM "role_has_permissions"
       WHERE "permission_id" = :id`,
      { id },
    );
    await connection.execute(
      `DELETE FROM "model_has_permissions"
       WHERE "permission_id" = :id`,
      { id },
    );
    const result = await connection.execute(
      `DELETE FROM "permissions"
       WHERE "id" = :id`,
      { id },
    );

    if (result.rowsAffected === 0) {
      throw notFound("permission not found");
    }
  });

  clearAccessCache();
  logPermissionAudit(req, "delete_permission", id);
}

module.exports = {
  createPermission,
  deletePermission,
  findPermission,
  listPermissions,
  updatePermission,
  validatePermissionPayload,
};
