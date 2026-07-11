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

function logPermissionAudit(req, action, permissionId, details = {}) {
  req.log.info(
    {
      audit: true,
      actor_user_id: req.user?.id,
      target_permission_id: permissionId,
      action,
      ...details,
    },
    "permission_admin_action"
  );
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
    }
  );

  return result.rows[0];
}

router.use(authenticate);

router.get("/", requirePermission("list permissions"), async (req, res, next) => {
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

router.get("/:id", requirePermission("view permissions"), async (req, res, next) => {
  let connection;

  try {
    const id = parsePositiveInteger(req.params.id);

    connection = await db.getConnection();
    const permission = await getPermissionById(connection, id);

    if (!permission) {
      throw notFound("permission not found");
    }

    res.json({ data: permission });
  } catch (error) {
    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.post("/", requirePermission("create permissions"), async (req, res, next) => {
  let connection;
  let shouldRollback = false;

  try {
    const payload = validatePermissionPayload(req.body);

    connection = await db.getConnection();
    shouldRollback = true;

    await connection.execute(`LOCK TABLE "permissions" IN EXCLUSIVE MODE`);

    const idResult = await connection.execute(
      `SELECT NVL(MAX("id"), 0) + 1 AS "next_id"
       FROM "permissions"`
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
      }
    );

    await connection.commit();
    shouldRollback = false;
    clearAccessCache();
    logPermissionAudit(req, "create_permission", nextId, { name: payload.name });

    res.status(201).json({ data: await getPermissionById(connection, nextId) });
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

async function updatePermission(req, res, next) {
  let connection;
  let shouldRollback = false;

  try {
    const id = parsePositiveInteger(req.params.id);
    const payload = validatePermissionPayload(req.body, { partial: true });
    const setClauses = Object.keys(payload).map((field) => `"${field}" = :${field}`);

    setClauses.push(`"updated_at" = SYSTIMESTAMP`);

    connection = await db.getConnection();
    shouldRollback = true;

    const result = await connection.execute(
      `UPDATE "permissions"
       SET ${setClauses.join(", ")}
       WHERE "id" = :id`,
      {
        ...payload,
        id,
      }
    );

    if (result.rowsAffected === 0) {
      throw notFound("permission not found");
    }

    await connection.commit();
    shouldRollback = false;
    clearAccessCache();
    logPermissionAudit(req, "update_permission", id, { fields: Object.keys(payload) });

    res.json({ data: await getPermissionById(connection, id) });
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

router.put("/:id", requirePermission("update permissions"), updatePermission);
router.patch("/:id", requirePermission("update permissions"), updatePermission);

router.delete("/:id", requirePermission("delete permissions"), async (req, res, next) => {
  let connection;
  let shouldRollback = false;

  try {
    const id = parsePositiveInteger(req.params.id);

    connection = await db.getConnection();
    shouldRollback = true;

    await connection.execute(
      `DELETE FROM "role_has_permissions"
       WHERE "permission_id" = :id`,
      { id }
    );
    await connection.execute(
      `DELETE FROM "model_has_permissions"
       WHERE "permission_id" = :id`,
      { id }
    );
    const result = await connection.execute(
      `DELETE FROM "permissions"
       WHERE "id" = :id`,
      { id }
    );

    if (result.rowsAffected === 0) {
      throw notFound("permission not found");
    }

    await connection.commit();
    shouldRollback = false;
    clearAccessCache();
    logPermissionAudit(req, "delete_permission", id);

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

module.exports = router;
