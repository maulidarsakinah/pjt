const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const db = require("../db");
const { buildListResponse, parsePagination } = require("../utils/pagination");

const COMPANY_FIELDS = ["name", "address", "contact"];

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function notFound(message = "company not found") {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function parseId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest("id must be a positive integer");
  }

  return id;
}

function validateCompanyPayload(body, { partial = false } = {}) {
  const payload = {};

  for (const field of COMPANY_FIELDS) {
    if (body[field] === undefined) {
      continue;
    }

    if (field === "name") {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        throw badRequest("name is required");
      }
    }

    if (body[field] !== null && typeof body[field] !== "string") {
      throw badRequest(`${field} must be a string or null`);
    }

    const value = body[field] === null ? null : body[field].trim();

    if (value !== null && value.length > 255) {
      throw badRequest(`${field} must be 255 characters or less`);
    }

    payload[field] = value;
  }

  if (!partial) {
    if (!payload.name) {
      throw badRequest("name is required");
    }
  }

  if (partial && Object.keys(payload).length === 0) {
    throw badRequest("at least one of name, address, or contact is required");
  }

  return payload;
}

async function getCompanyById(connection, id) {
  const result = await connection.execute(
    `SELECT
       "id" AS "id",
       "name" AS "name",
       "address" AS "address",
       "contact" AS "contact",
       "created_at" AS "created_at",
       "updated_at" AS "updated_at"
     FROM "companies"
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

router.get("/", requirePermission("list companies"), async (req, res, next) => {
  let connection;

  try {
    const pagination = parsePagination(req.query);

    connection = await db.getConnection();
    const result = await connection.execute(
      `SELECT
         "id",
         "name",
         "address",
         "contact",
         "created_at",
         "updated_at"
       FROM (
         SELECT page_query.*, ROWNUM AS "rn"
         FROM (
           SELECT
             "id" AS "id",
             "name" AS "name",
             "address" AS "address",
             "contact" AS "contact",
             "created_at" AS "created_at",
             "updated_at" AS "updated_at"
           FROM "companies"
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
      try {
        await connection.close();
      } catch (error) {
        req.log.error(
          {
            err: error,
            status: "failed",
            error: error.message,
          },
          "database_connection_close_failed"
        );
      }
    }
  }
});

router.get("/:id", requirePermission("view companies"), async (req, res, next) => {
  let connection;

  try {
    const id = parseId(req.params.id);

    connection = await db.getConnection();
    const company = await getCompanyById(connection, id);

    if (!company) {
      throw notFound();
    }

    res.json({ data: company });
  } catch (error) {
    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.post("/", requirePermission("create companies"), async (req, res, next) => {
  let connection;
  let shouldRollback = false;

  try {
    const payload = validateCompanyPayload(req.body);

    connection = await db.getConnection();
    shouldRollback = true;

    await connection.execute(`LOCK TABLE "companies" IN EXCLUSIVE MODE`);

    const idResult = await connection.execute(
      `SELECT NVL(MAX("id"), 0) + 1 AS "next_id"
       FROM "companies"`
    );
    const nextId = idResult.rows[0].next_id;

    await connection.execute(
      `INSERT INTO "companies" (
         "id",
         "name",
         "address",
         "contact",
         "created_at",
         "updated_at"
       ) VALUES (
         :id,
         :name,
         :address,
         :contact,
         SYSTIMESTAMP,
         SYSTIMESTAMP
       )`,
      {
        id: nextId,
        name: payload.name,
        address: payload.address || null,
        contact: payload.contact || null,
      }
    );

    await connection.commit();
    shouldRollback = false;

    const company = await getCompanyById(connection, nextId);

    res.status(201).json({ data: company });
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

async function updateCompany(req, res, next) {
  let connection;
  let shouldRollback = false;

  try {
    const id = parseId(req.params.id);
    const payload = validateCompanyPayload(req.body, { partial: true });
    const setClauses = Object.keys(payload).map((field) => `"${field}" = :${field}`);

    setClauses.push(`"updated_at" = SYSTIMESTAMP`);

    connection = await db.getConnection();
    shouldRollback = true;

    const result = await connection.execute(
      `UPDATE "companies"
       SET ${setClauses.join(", ")}
       WHERE "id" = :id`,
      {
        ...payload,
        id,
      }
    );

    if (result.rowsAffected === 0) {
      throw notFound();
    }

    await connection.commit();
    shouldRollback = false;

    const company = await getCompanyById(connection, id);

    res.json({ data: company });
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

router.put("/:id", requirePermission("update companies"), updateCompany);
router.patch("/:id", requirePermission("update companies"), updateCompany);

router.delete("/:id", requirePermission("delete companies"), async (req, res, next) => {
  let connection;
  let shouldRollback = false;

  try {
    const id = parseId(req.params.id);

    connection = await db.getConnection();
    shouldRollback = true;

    const result = await connection.execute(
      `DELETE FROM "companies"
       WHERE "id" = :id`,
      { id }
    );

    if (result.rowsAffected === 0) {
      throw notFound();
    }

    await connection.commit();
    shouldRollback = false;

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
