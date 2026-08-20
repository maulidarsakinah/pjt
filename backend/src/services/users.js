const bcrypt = require("bcryptjs");
const authenticate = require("../middleware/authenticate");
const { revokeUserTokens } = require("../tokenRevocation");
const { withConnection, withTransaction } = require("./database");
const { buildFieldChanges, writeAuditEvent } = require("./audit");
const { clearAccessCache } = require("./access");
const { badRequest, conflict, notFound } = require("../utils/httpErrors");
const {
  optionalString,
  parsePositiveInteger,
  requiredString,
} = require("../utils/validation");

const { getLatestLoginsByUser } = require("./logs");

const PHONE_REGEX = /^\+?[\d\s\-.()]{7,20}$/;

function normalizeStatus(value, field = "status") {
  if (value === undefined) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "active", "aktif"].includes(normalized)) return "1";
  if (["0", "inactive", "non-aktif", "nonaktif"].includes(normalized))
    return "0";
  throw badRequest(`${field} must be active or inactive`);
}

function parseRoleIds(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw badRequest("role_ids must be an array");
  return [...new Set(value.map((id) => parsePositiveInteger(id, "role_id")))];
}

function validateUserPayload(body, { partial = false } = {}) {
  const payload = {};
  if (!partial || body.name !== undefined)
    payload.name = requiredString(body.name, "name");
  if (!partial || body.email !== undefined) {
    payload.email = requiredString(body.email, "email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email))
      throw badRequest("email must be a valid email address");
  }
  if (body.phone !== undefined) {
    payload.phone = optionalString(body.phone, "phone");
    if (payload.phone !== null && payload.phone !== undefined && !PHONE_REGEX.test(payload.phone)) {
      throw badRequest("phone must be a valid phone number (7–20 digits)");
    }
  }
  if (body.status !== undefined) payload.status = normalizeStatus(body.status);
  if (body.company_id !== undefined)
    payload.company_id = parsePositiveInteger(body.company_id, "company_id");
  if (partial && Object.keys(payload).length === 0)
    throw badRequest("at least one user field is required");
  return payload;
}

async function userById(connection, id) {
  const result = await connection.execute(
    `SELECT "id" AS "id", "name" AS "name", "email" AS "email", "phone" AS "phone",
            "status" AS "status", "company_id" AS "company_id", "created_at" AS "created_at",
            "updated_at" AS "updated_at"
     FROM "users" WHERE "id" = :id AND ROWNUM = 1`,
    { id },
    { fetchArraySize: 1, maxRows: 1 },
  );
  return result.rows[0];
}

async function assertRoles(connection, roleIds) {
  if (!roleIds?.length) return;
  const binds = {};
  const placeholders = roleIds.map((id, index) => {
    const key = `role${index}`;
    binds[key] = id;
    return `:${key}`;
  });
  const result = await connection.execute(
    `SELECT "id" AS "id" FROM "roles" WHERE "id" IN (${placeholders.join(", ")})`,
    binds,
  );
  const found = new Set(result.rows.map((row) => row.id));
  const missing = roleIds.filter((id) => !found.has(id));
  if (missing.length)
    throw badRequest(`role_ids not found: ${missing.join(", ")}`);
}

async function getRoles(connection, userId) {
  const result = await connection.execute(
    `SELECT r."id" AS "id", r."name" AS "name", r."guard_name" AS "guard_name"
     FROM "roles" r INNER JOIN "model_has_roles" mhr ON mhr."role_id" = r."id"
     WHERE mhr."model_id" = :user_id AND mhr."model_type" = 'App\\Models\\User' ORDER BY r."id"`,
    { user_id: userId },
  );
  return result.rows;
}

async function hydrateUser(connection, row) {
  if (!row) return null;
  const recentLogins = await getLatestLoginsByUser();
  return {
    ...row,
    roles: await getRoles(connection, row.id),
    last_login_at: recentLogins[row.id] || null,
  };
}

function buildUserListQuery({ limit, offset, search, roleId, status, excludeUserId }) {
  const filterBinds = {};
  const conditions = [];
  if (search) {
    const normalizedSearch = search.trim().toLowerCase();
    if (normalizedSearch.length > 200) {
      throw badRequest("search must be 200 characters or fewer");
    }
    filterBinds.search = `%${normalizedSearch}%`;
    conditions.push(
      `(LOWER(u."name") LIKE :search OR LOWER(u."email") LIKE :search OR TO_CHAR(u."id") LIKE :search)`,
    );
  }
  if (roleId) {
    filterBinds.role_id = roleId;
    conditions.push(
      `EXISTS (SELECT 1 FROM "model_has_roles" fr WHERE fr."model_id" = u."id" AND fr."model_type" = 'App\\Models\\User' AND fr."role_id" = :role_id)`,
    );
  }
  if (status !== undefined) {
    filterBinds.status = normalizeStatus(status);
    conditions.push(`u."status" = :status`);
  }
  if (excludeUserId !== undefined) {
    filterBinds.exclude_user_id = parsePositiveInteger(
      excludeUserId,
      "exclude_user_id",
    );
    conditions.push(`u."id" <> :exclude_user_id`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const base = `SELECT u."id" AS "id", u."name" AS "name", u."email" AS "email", u."phone" AS "phone",
      u."status" AS "status", u."company_id" AS "company_id", u."created_at" AS "created_at", u."updated_at" AS "updated_at",
      (SELECT LISTAGG(r."name", ', ') WITHIN GROUP (ORDER BY r."id") FROM "roles" r INNER JOIN "model_has_roles" m ON m."role_id" = r."id" WHERE m."model_id" = u."id" AND m."model_type" = 'App\\Models\\User') AS "role_name"
      FROM "users" u ${where} ORDER BY u."id" ASC`;
  return {
    countSql: `SELECT COUNT(*) AS "total" FROM "users" u ${where}`,
    filterBinds,
    pageBinds: { ...filterBinds, offset, page_end: offset + limit + 1 },
    pageSql: `SELECT * FROM (SELECT page_query.*, ROWNUM AS "rn" FROM (${base}) page_query WHERE ROWNUM <= :page_end) WHERE "rn" > :offset`,
  };
}

async function listUsers(options) {
  const { limit } = options;
  const query = buildUserListQuery(options);
  const recentLogins = await getLatestLoginsByUser();
  return withConnection(async (connection) => {
    const page = await connection.execute(query.pageSql, query.pageBinds, {
      fetchArraySize: Math.min(limit + 1, 100),
      maxRows: limit + 1,
    });
    const count = await connection.execute(query.countSql, query.filterBinds, {
      fetchArraySize: 1,
      maxRows: 1,
    });
    return {
      data: page.rows.slice(0, limit).map(({ rn, ...row }) => ({
        ...row,
        roles: row.role_name ? row.role_name.split(", ") : [],
        last_login_at: recentLogins[row.id] || null,
      })),
      total: count.rows[0].total,
      has_more: page.rows.length > limit,
    };
  });
}

async function getUserSummary() {
  return withConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT
         COUNT(*) AS "total",
         NVL(SUM("is_active"), 0) AS "active",
         NVL(SUM("is_admin"), 0) AS "admin",
         NVL(SUM("is_operator"), 0) AS "operator"
       FROM (
         SELECT
           u."id",
           CASE WHEN u."status" = '1' THEN 1 ELSE 0 END AS "is_active",
           MAX(CASE WHEN LOWER(r."name") IN ('admin', 'administrator', 'super-admin', 'superadmin') THEN 1 ELSE 0 END) AS "is_admin",
           MAX(CASE WHEN LOWER(r."name") = 'operator' THEN 1 ELSE 0 END) AS "is_operator"
         FROM "users" u
         LEFT JOIN "model_has_roles" m
           ON m."model_id" = u."id"
          AND m."model_type" = 'App\\Models\\User'
         LEFT JOIN "roles" r ON r."id" = m."role_id"
         GROUP BY u."id", u."status"
       ) user_summary`,
      {},
      { fetchArraySize: 1, maxRows: 1 },
    );
    return result.rows[0];
  });
}

async function getUser(id) {
  return withConnection(async (connection) =>
    hydrateUser(connection, await userById(connection, id)),
  );
}

async function getUserIdentities(ids) {
  const userIds = [
    ...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0)),
  ];
  if (!userIds.length) return new Map();

  return withConnection(async (connection) => {
    const binds = {};
    const placeholders = userIds.map((id, index) => {
      const key = `user${index}`;
      binds[key] = id;
      return `:${key}`;
    });
    const result = await connection.execute(
      `SELECT "id" AS "id", "name" AS "name"
       FROM "users"
       WHERE "id" IN (${placeholders.join(", ")})`,
      binds,
      {
        fetchArraySize: Math.min(userIds.length, 200),
        maxRows: userIds.length,
      },
    );

    return new Map(result.rows.map((user) => [Number(user.id), user.name]));
  });
}

async function createUser(body, actor, req) {
  const payload = validateUserPayload(body);
  const password = requiredString(body.password, "password");
  if (password.length < 8)
    throw badRequest("password must be at least 8 characters");
  const roleIds =
    parseRoleIds(
      body.role_ids ||
        (body.role_id !== undefined ? [body.role_id] : undefined),
    ) || [];
  const companyId = payload.company_id || actor.company_id;
  if (!companyId) throw badRequest("company_id is required");
  const result = await withTransaction(async (connection) => {
    await connection.execute(`LOCK TABLE "users" IN EXCLUSIVE MODE`);
    const existing = await connection.execute(
      `SELECT "id" FROM "users" WHERE LOWER("email") = :email AND ROWNUM = 1`,
      { email: payload.email },
      { maxRows: 1 },
    );
    if (existing.rows.length) throw conflict("email is already registered");
    await assertRoles(connection, roleIds);
    const next = await connection.execute(
      `SELECT NVL(MAX("id"), 0) + 1 AS "id" FROM "users"`,
    );
    const id = next.rows[0].id;
    const hashed = await bcrypt.hash(password, 12);
    await connection.execute(
      `INSERT INTO "users" ("id", "name", "email", "password", "phone", "status", "company_id", "created_at", "updated_at") VALUES (:id, :name, :email, :password, :phone, :status, :company_id, SYSTIMESTAMP, SYSTIMESTAMP)`,
      {
        id,
        ...payload,
        password: hashed,
        phone: payload.phone ?? null,
        status: payload.status || "1",
        company_id: companyId,
      },
    );
    for (const roleId of roleIds)
      await connection.execute(
        `INSERT INTO "model_has_roles" ("role_id", "model_type", "model_id") VALUES (:role_id, 'App\\Models\\User', :user_id)`,
        { role_id: roleId, user_id: id },
      );
    return hydrateUser(connection, await userById(connection, id));
  });
  clearAccessCache();
  writeAuditEvent(req, {
    category: "access_admin",
    action: "create_user",
    targetType: "user",
    targetId: result.id,
  });
  return result;
}

async function updateUser(id, body, req) {
  const payload = validateUserPayload(body, { partial: true });
  const roleIds = parseRoleIds(body.role_ids);
  const result = await withTransaction(async (connection) => {
    const before = await hydrateUser(
      connection,
      await userById(connection, id),
    );

    if (!before) throw notFound("user not found");
    if (payload.email) {
      const duplicate = await connection.execute(
        `SELECT "id" FROM "users" WHERE LOWER("email") = :email AND "id" <> :id AND ROWNUM = 1`,
        { email: payload.email, id },
        { maxRows: 1 },
      );
      if (duplicate.rows.length) throw conflict("email is already registered");
    }
    if (payload.company_id) await assertCompany(connection, payload.company_id);
    const ALLOWED_UPDATE_FIELDS = ["name", "email", "phone", "status", "company_id"];
    const fields = Object.keys(payload).filter((f) =>
      ALLOWED_UPDATE_FIELDS.includes(f),
    );
    if (fields.length)
      await connection.execute(
        `UPDATE "users" SET ${fields.map((field) => `"${field}" = :${field}`).join(", ")}, "updated_at" = SYSTIMESTAMP WHERE "id" = :id`,
        { ...payload, id },
      );
    if (roleIds) {
      await assertRoles(connection, roleIds);
      await connection.execute(
        `DELETE FROM "model_has_roles" WHERE "model_id" = :id AND "model_type" = 'App\\Models\\User'`,
        { id },
      );
      for (const roleId of roleIds)
        await connection.execute(
          `INSERT INTO "model_has_roles" ("role_id", "model_type", "model_id") VALUES (:role_id, 'App\\Models\\User', :id)`,
          { role_id: roleId, id },
        );
    }
    const user = await hydrateUser(connection, await userById(connection, id));
    const touchedFields = [
      ...Object.keys(payload),
      ...(roleIds ? ["role_ids"] : []),
    ];
    const beforeValues = {
      ...before,
      role_ids: before.roles.map((role) => role.id),
    };
    const afterValues = {
      ...user,
      role_ids: user.roles.map((role) => role.id),
    };

    return {
      changes: buildFieldChanges(beforeValues, afterValues, touchedFields, {
        targetType: "user",
      }),
      user,
    };
  });
  clearAccessCache();
  authenticate.invalidateUser(id);
  if (result.user.status !== "1") {
    revokeUserTokens(id);
  }
  writeAuditEvent(req, {
    category: "access_admin",
    action: "update_user",
    targetType: "user",
    targetId: id,
    changes: result.changes,
  });
  return result.user;
}

async function assertCompany(connection, companyId) {
  const result = await connection.execute(
    `SELECT "id" FROM "companies" WHERE "id" = :id AND ROWNUM = 1`,
    { id: companyId },
    { maxRows: 1 },
  );
  if (!result.rows.length) throw badRequest("company_id does not exist");
}

async function resetUserPassword(id, password, req) {
  const safePassword = requiredString(password, "password");
  if (safePassword.length < 8)
    throw badRequest("password must be at least 8 characters");
  const hashed = await bcrypt.hash(safePassword, 12);
  await withConnection(async (connection) => {
    const result = await connection.execute(
      `UPDATE "users" SET "password" = :password, "updated_at" = SYSTIMESTAMP WHERE "id" = :id`,
      { password: hashed, id },
      { autoCommit: true },
    );
    if (!result.rowsAffected) throw notFound("user not found");
  });
  authenticate.invalidateUser(id);
  revokeUserTokens(id);
  writeAuditEvent(req, {
    category: "access_admin",
    action: "reset_user_password",
    targetType: "user",
    targetId: id,
  });
}

async function deleteUser(id, actorId, req) {
  const targetId = parsePositiveInteger(id);
  const requestingUserId = parsePositiveInteger(actorId, "actor_id");

  if (targetId === requestingUserId) {
    throw badRequest("you cannot delete your own account");
  }

  await withTransaction(async (connection) => {
    const existing = await userById(connection, targetId);
    if (!existing) throw notFound("user not found");

    await connection.execute(
      `DELETE FROM "tb_notification_reads" WHERE "USER_ID" = :id`,
      { id: targetId },
    );
    await connection.execute(
      `DELETE FROM "model_has_permissions" WHERE "model_id" = :id AND "model_type" = 'App\\Models\\User'`,
      { id: targetId },
    );
    await connection.execute(
      `DELETE FROM "model_has_roles" WHERE "model_id" = :id AND "model_type" = 'App\\Models\\User'`,
      { id: targetId },
    );
    const result = await connection.execute(
      `DELETE FROM "users" WHERE "id" = :id`,
      { id: targetId },
    );

    if (!result.rowsAffected) throw notFound("user not found");
  });

  clearAccessCache();
  authenticate.invalidateUser(targetId);
  revokeUserTokens(targetId);
  writeAuditEvent(req, {
    category: "access_admin",
    action: "delete_user",
    targetType: "user",
    targetId,
  });
}

module.exports = {
  buildUserListQuery,
  createUser,
  deleteUser,
  getUser,
  getUserIdentities,
  getUserSummary,
  listUsers,
  resetUserPassword,
  updateUser,
};
