const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const { clearAccessCache } = require("../services/access");
const db = require("../db");
const { badRequest, notFound } = require("../utils/httpErrors");
const { buildListResponse, parsePagination } = require("../utils/pagination");
const {
  parsePositiveInteger,
  requiredString,
} = require("../utils/validation");

function logRoleAudit(req, action, roleId, details = {}) {
  req.log.info(
    {
      audit: true,
      actor_user_id: req.user?.id,
      target_role_id: roleId,
      action,
      ...details,
    },
    "role_admin_action"
  );
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

router.use(authenticate);

router.get("/", requirePermission("list roles"), async (req, res, next) => {
  let connection;

  try {
    const pagination = parsePagination(req.query);

    connection = await db.getConnection();
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

    res.json(buildListResponse(result.rows, pagination));
  } catch (error) {
    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.get("/:id", requirePermission("view roles"), async (req, res, next) => {
  let connection;

  try {
    const id = parsePositiveInteger(req.params.id);

    connection = await db.getConnection();
    const role = await getRoleById(connection, id);

    if (!role) {
      throw notFound("role not found");
    }

    res.json({ data: role });
  } catch (error) {
    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.post("/", requirePermission("create roles"), async (req, res, next) => {
  let connection;
  let shouldRollback = false;

  try {
    const payload = validateRolePayload(req.body);

    connection = await db.getConnection();
    shouldRollback = true;

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

    await connection.commit();
    shouldRollback = false;
    logRoleAudit(req, "create_role", nextId, { name: payload.name });

    res.status(201).json({ data: await getRoleById(connection, nextId) });
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

async function updateRole(req, res, next) {
  let connection;
  let shouldRollback = false;

  try {
    const id = parsePositiveInteger(req.params.id);
    const payload = validateRolePayload(req.body, { partial: true });
    const setClauses = Object.keys(payload).map((field) => `"${field}" = :${field}`);

    setClauses.push(`"updated_at" = SYSTIMESTAMP`);

    connection = await db.getConnection();
    shouldRollback = true;

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

    await connection.commit();
    shouldRollback = false;
    clearAccessCache();
    logRoleAudit(req, "update_role", id, { fields: Object.keys(payload) });

    res.json({ data: await getRoleById(connection, id) });
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
}

router.put("/:id", requirePermission("update roles"), updateRole);
router.patch("/:id", requirePermission("update roles"), updateRole);

router.delete("/:id", requirePermission("delete roles"), async (req, res, next) => {
  let connection;
  let shouldRollback = false;

  try {
    const id = parsePositiveInteger(req.params.id);

    connection = await db.getConnection();
    shouldRollback = true;

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

    await connection.commit();
    shouldRollback = false;
    clearAccessCache();
    logRoleAudit(req, "delete_role", id);

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

router.get("/:id/permissions", requirePermission("view roles"), async (req, res, next) => {
  let connection;

  try {
    const id = parsePositiveInteger(req.params.id);

    connection = await db.getConnection();

    if (!(await getRoleById(connection, id))) {
      throw notFound("role not found");
    }

    const permissions = await getRolePermissions(connection, id);

    res.json({
      data: permissions,
      count: permissions.length,
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.put("/:id/permissions", requirePermission("update roles"), async (req, res, next) => {
  let connection;
  let shouldRollback = false;

  try {
    const id = parsePositiveInteger(req.params.id);
    const permissionIds = parsePermissionIds(req.body.permission_ids);

    connection = await db.getConnection();
    shouldRollback = true;

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

    await connection.commit();
    shouldRollback = false;
    clearAccessCache();
    logRoleAudit(req, "replace_role_permissions", id, { permission_ids: permissionIds });

    const permissions = await getRolePermissions(connection, id);

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
