const db = require("../db");
const { badRequest, conflict, notFound } = require("../utils/httpErrors");

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

async function assertUniqueCompanyName(connection, name, excludeId) {
  const binds = { name: name.toLowerCase() };
  const exclusions = [];

  if (excludeId !== undefined) {
    binds.exclude_id = excludeId;
    exclusions.push(`"id" <> :exclude_id`);
  }

  const result = await connection.execute(
    `SELECT "id"
     FROM "companies"
     WHERE LOWER("name") = :name
       ${exclusions.length ? `AND ${exclusions.join(" AND ")}` : ""}
       AND ROWNUM = 1`,
    binds,
    { maxRows: 1 },
  );

  if (result.rows.length) {
    throw conflict("Nama perusahaan sudah terdaftar");
  }
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
    await assertUniqueCompanyName(connection, payload.name);

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

    return {
      id: nextId,
      name: payload.name,
      address: payload.address || null,
      contact: payload.contact || null,
    };
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
    const ALLOWED_UPDATE_FIELDS = ["name", "address", "contact"];
    const setClauses = Object.keys(payload)
      .filter((field) => ALLOWED_UPDATE_FIELDS.includes(field))
      .map((field) => `"${field}" = :${field}`);

    setClauses.push(`"updated_at" = SYSTIMESTAMP`);

    connection = await db.getConnection();
    shouldRollback = true;

    if (payload.name !== undefined) {
      await connection.execute(`LOCK TABLE "companies" IN EXCLUSIVE MODE`);
      await assertUniqueCompanyName(connection, payload.name, id);
    }

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

    const company = await getCompanyById(connection, id);
    await connection.commit();
    shouldRollback = false;

    return company;
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

    if (error.code === "ORA-02292") {
      throw conflict("Perusahaan tidak dapat dihapus karena masih digunakan oleh akun pengguna");
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
