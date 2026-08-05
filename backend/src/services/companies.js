const db = require("../db");
const { badRequest, notFound } = require("../utils/httpErrors");

const COMPANY_FIELDS = ["name", "address", "contact"];

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

  if (!partial && !payload.name) {
    throw badRequest("name is required");
  }

  if (!partial) {
    payload.address ??= null;
    payload.contact ??= null;
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
    },
  );

  return result.rows[0];
}

async function listCompanies(pagination) {
  let connection;

  try {
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
      },
    );

    return result.rows;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

async function findCompany(id) {
  let connection;

  try {
    connection = await db.getConnection();
    return getCompanyById(connection, id);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

async function createCompany(payload) {
  let connection;
  let shouldRollback = false;

  try {
    connection = await db.getConnection();
    shouldRollback = true;

    await connection.execute(`LOCK TABLE "companies" IN EXCLUSIVE MODE`);

    const idResult = await connection.execute(
      `SELECT NVL(MAX("id"), 0) + 1 AS "next_id"
       FROM "companies"`,
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
      },
    );

    await connection.commit();
    shouldRollback = false;

    return getCompanyById(connection, nextId);
  } catch (error) {
    if (connection && shouldRollback) {
      await connection.rollback();
    }

    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

async function updateCompany(id, payload) {
  let connection;
  let shouldRollback = false;

  try {
    const setClauses = Object.keys(payload).map(
      (field) => `"${field}" = :${field}`,
    );

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
      },
    );

    if (result.rowsAffected === 0) {
      throw notFound("company not found");
    }

    await connection.commit();
    shouldRollback = false;

    return getCompanyById(connection, id);
  } catch (error) {
    if (connection && shouldRollback) {
      await connection.rollback();
    }

    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

async function deleteCompany(id) {
  let connection;
  let shouldRollback = false;

  try {
    connection = await db.getConnection();
    shouldRollback = true;

    const result = await connection.execute(
      `DELETE FROM "companies"
       WHERE "id" = :id`,
      { id },
    );

    if (result.rowsAffected === 0) {
      throw notFound("company not found");
    }

    await connection.commit();
    shouldRollback = false;
  } catch (error) {
    if (connection && shouldRollback) {
      await connection.rollback();
    }

    throw error;
  } finally {
    if (connection) {
      await connection.close();
    }
  }
}

module.exports = {
  createCompany,
  deleteCompany,
  findCompany,
  listCompanies,
  updateCompany,
  validateCompanyPayload,
};
