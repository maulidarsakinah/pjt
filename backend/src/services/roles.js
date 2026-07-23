const { clearAccessCache } = require("./access");
const { writeAuditEvent } = require("./audit");
const { withConnection, withTransaction } = require("./database");
const { badRequest, notFound } = require("../utils/httpErrors");
const { parsePositiveInteger, requiredString } = require("../utils/validation");

function logRoleAudit(req, action, roleId, details = {}) {
  writeAuditEvent(req, {
    category: "access_admin",
    action,
    targetType: "role",
    targetId: roleId,
    metadata: details,
  });
}

function validateRolePayload(body, { partial = false } = {}) {
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

async function getRoleById(connection, id) {
  const result = await connection.execute(
    `SELECT
       "id" AS "id",
       "name" AS "name",
       "guard_name" AS "guard_name",
       "created_at" AS "created_at",
       "updated_at" AS "updated_at"
     FROM "roles"
     WHERE "id" = :id
     AND ROWNUM = 1`,
    { id },
    {
      fetchArraySize: 1,
      maxRows: 1,
    }
  );

  return result.rows[0];
}

async function getRolePermissions(connection, roleId) {
  const result = await connection.execute(
    `SELECT
       p."id" AS "id",
       p."name" AS "name",
       p."guard_name" AS "guard_name"
     FROM "permissions" p
     INNER JOIN "role_has_permissions" rhp
       ON rhp."permission_id" = p."id"
     WHERE rhp."role_id" = :role_id
     ORDER BY p."id" ASC`,
    { role_id: roleId }
  );

  return result.rows;
}

async function assertPermissionIdsExist(connection, permissionIds) {
  if (permissionIds.length === 0) {
    return;
  }

  const binds = {};
  const placeholders = permissionIds.map((id, index) => {
    const key = `id${index}`;

    binds[key] = id;
    return `:${key}`;
  });

  const result = await connection.execute(
    `SELECT "id" AS "id"
     FROM "permissions"
     WHERE "id" IN (${placeholders.join(", ")})`,
    binds
  );
  const foundIds = new Set(result.rows.map((row) => row.id));
  const missingIds = permissionIds.filter((id) => !foundIds.has(id));

  if (missingIds.length > 0) {
    throw badRequest(`permission_ids not found: ${missingIds.join(", ")}`);
  }
}

function parsePermissionIds(value) {
  if (!Array.isArray(value)) {
    throw badRequest("permission_ids must be an array");
  }

  return [...new Set(value.map((id) => parsePositiveInteger(id, "permission_id")))];
}

async function listRoles(pagination) {
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
           FROM "roles"
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
      }
    );

    return result.rows;
  });
}

async function findRole(id) {
  return withConnection((connection) => getRoleById(connection, id));
}

async function createRole(body, req) {
  const payload = validateRolePayload(body);
  const result = await withTransaction(async (connection) => {
    await connection.execute(`LOCK TABLE "roles" IN EXCLUSIVE MODE`);

    const idResult = await connection.execute(
      `SELECT NVL(MAX("id"), 0) + 1 AS "next_id"
       FROM "roles"`
    );
    const nextId = idResult.rows[0].next_id;

    await connection.execute(
      `INSERT INTO "roles" (
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
      }
    );

    const role = await getRoleById(connection, nextId);

    return { role, roleId: nextId, name: payload.name };
  });

  logRoleAudit(req, "create_role", result.roleId, { name: result.name });
  return result.role;
}

async function updateRole(id, body, req, { partial = true } = {}) {
  const payload = validateRolePayload(body, { partial });
  const result = await withTransaction(async (connection) => {
    const setClauses = Object.keys(payload).map((field) => `"${field}" = :${field}`);

    setClauses.push(`"updated_at" = SYSTIMESTAMP`);

    const result = await connection.execute(
      `UPDATE "roles"
       SET ${setClauses.join(", ")}
       WHERE "id" = :id`,
      {
        ...payload,
        id,
      }
    );

    if (result.rowsAffected === 0) {
      throw notFound("role not found");
    }

    return {
      role: await getRoleById(connection, id),
      fields: Object.keys(payload),
    };
  });

  clearAccessCache();
  logRoleAudit(req, "update_role", id, { fields: result.fields });
  return result.role;
}

async function deleteRole(id, req) {
  await withTransaction(async (connection) => {
    await connection.execute(
      `DELETE FROM "role_has_permissions"
       WHERE "role_id" = :id`,
      { id }
    );
    await connection.execute(
      `DELETE FROM "model_has_roles"
       WHERE "role_id" = :id`,
      { id }
    );
    const result = await connection.execute(
      `DELETE FROM "roles"
       WHERE "id" = :id`,
      { id }
    );

    if (result.rowsAffected === 0) {
      throw notFound("role not found");
    }
  });

  clearAccessCache();
  logRoleAudit(req, "delete_role", id);
}

async function listRolePermissions(id) {
  return withConnection(async (connection) => {
    if (!(await getRoleById(connection, id))) {
      throw notFound("role not found");
    }

    return getRolePermissions(connection, id);
  });
}

async function replaceRolePermissions(id, permissionIdsValue, req) {
  const permissionIds = parsePermissionIds(permissionIdsValue);
  const permissions = await withTransaction(async (connection) => {
    if (!(await getRoleById(connection, id))) {
      throw notFound("role not found");
    }

    await assertPermissionIdsExist(connection, permissionIds);

    await connection.execute(
      `DELETE FROM "role_has_permissions"
       WHERE "role_id" = :role_id`,
      { role_id: id }
    );

    for (const permissionId of permissionIds) {
      await connection.execute(
        `INSERT INTO "role_has_permissions" (
           "permission_id",
           "role_id"
         ) VALUES (
           :permission_id,
           :role_id
         )`,
        {
          permission_id: permissionId,
          role_id: id,
        }
      );
    }

    return getRolePermissions(connection, id);
  });

  clearAccessCache();
  logRoleAudit(req, "replace_role_permissions", id, { permission_ids: permissionIds });
  return permissions;
}

module.exports = {
  createRole,
  deleteRole,
  findRole,
  listRolePermissions,
  listRoles,
  replaceRolePermissions,
  updateRole,
  validateRolePayload,
};
