const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const oracledb = require("oracledb");
const router = require("express").Router();
const config = require("../config");
const db = require("../db");
const { authRateLimit } = require("../middleware/security");

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function conflict(message) {
  const error = new Error(message);
  error.statusCode = 409;
  return error;
}

function unauthorized(message) {
  const error = new Error(message);
  error.statusCode = 401;
  return error;
}

function publicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    status: row.status,
    company_id: row.company_id,
    email_verified_at: row.email_verified_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateString(value, field, maxLength = 255) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw badRequest(`${field} is required`);
  }

  if (value.trim().length > maxLength) {
    throw badRequest(`${field} must be ${maxLength} characters or less`);
  }

  return value.trim();
}

function createToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      company_id: user.company_id,
    },
    config.auth.jwtSecret,
    {
      expiresIn: config.auth.jwtExpiresIn,
      issuer: config.auth.jwtIssuer,
      audience: config.auth.jwtAudience,
    }
  );
}

router.post("/register", authRateLimit, async (req, res, next) => {
  let connection;

  try {
    const { name, email, password, phone, company_id } = req.body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!name || !normalizedEmail || !password || !phone || company_id === undefined) {
      throw badRequest("name, email, password, phone, and company_id are required");
    }

    if (!isValidEmail(normalizedEmail)) {
      throw badRequest("email must be a valid email address");
    }

    const safeName = validateString(name, "name");
    const safePhone = validateString(phone, "phone");
    const safePassword = validateString(String(password), "password");
    const safeCompanyId = Number(company_id);

    if (!Number.isInteger(safeCompanyId) || safeCompanyId <= 0) {
      throw badRequest("company_id must be a positive integer");
    }

    if (safePassword.length < 8) {
      throw badRequest("password must be at least 8 characters");
    }

    connection = await db.getConnection();

    const company = await connection.execute(
      `SELECT "id" AS "id"
       FROM "companies"
       WHERE "id" = :company_id
       AND ROWNUM = 1`,
      { company_id: safeCompanyId },
      {
        fetchArraySize: 1,
        maxRows: 1,
      }
    );

    if (company.rows.length === 0) {
      throw badRequest("company_id does not exist");
    }

    await connection.execute(`LOCK TABLE "users" IN EXCLUSIVE MODE`);

    const existing = await connection.execute(
      `SELECT "id" AS "id"
       FROM "users"
       WHERE LOWER("email") = :email
       AND ROWNUM = 1`,
      { email: normalizedEmail },
      {
        fetchArraySize: 1,
        maxRows: 1,
      }
    );

    if (existing.rows.length > 0) {
      throw conflict("email is already registered");
    }

    const idResult = await connection.execute(
      `SELECT NVL(MAX("id"), 0) + 1 AS "next_id"
       FROM "users"`,
      {},
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const nextId = idResult.rows[0].next_id;
    const hashedPassword = await bcrypt.hash(safePassword, 12);

    await connection.execute(
      `INSERT INTO "users" (
         "id",
         "name",
         "email",
         "password",
         "phone",
         "status",
         "company_id",
         "created_at",
         "updated_at"
       ) VALUES (
         :id,
         :name,
         :email,
         :password,
         :phone,
         :status,
         :company_id,
         SYSTIMESTAMP,
         SYSTIMESTAMP
       )`,
      {
        id: nextId,
        name: safeName,
        email: normalizedEmail,
        password: hashedPassword,
        phone: safePhone,
        status: "1",
        company_id: safeCompanyId,
      },
      { autoCommit: true }
    );

    const user = {
      id: nextId,
      name: safeName,
      email: normalizedEmail,
      phone: safePhone,
      status: "1",
      company_id: safeCompanyId,
      email_verified_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    req.log.info(
      {
        user_id: nextId,
        status: "success",
      },
      "user_registered"
    );

    res.status(201).json({
      user,
      token: createToken(user),
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.post("/login", authRateLimit, async (req, res, next) => {
  let connection;

  try {
    const { email, password } = req.body;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !password) {
      throw badRequest("email and password are required");
    }

    if (String(password).length > 255) {
      throw badRequest("password must be 255 characters or less");
    }

    if (!isValidEmail(normalizedEmail)) {
      throw badRequest("email must be a valid email address");
    }

    connection = await db.getConnection();
    const result = await connection.execute(
      `SELECT
         "id" AS "id",
         "name" AS "name",
         "email" AS "email",
         "email_verified_at" AS "email_verified_at",
         "password" AS "password",
         "phone" AS "phone",
         "status" AS "status",
         "company_id" AS "company_id",
         "created_at" AS "created_at",
         "updated_at" AS "updated_at"
       FROM "users"
       WHERE LOWER("email") = :email
       AND ROWNUM = 1`,
      { email: normalizedEmail },
      {
        fetchArraySize: 1,
        maxRows: 1,
      }
    );

    const user = result.rows[0];

    if (!user) {
      req.log.warn(
        {
          status: "failed",
          error: "invalid credentials",
        },
        "user_login_failed"
      );
      throw unauthorized("invalid email or password");
    }

    if (user.status !== "1") {
      req.log.warn(
        {
          user_id: user.id,
          status: "failed",
          error: "inactive account",
        },
        "user_login_failed"
      );
      throw unauthorized("invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(String(password), user.password);

    if (!passwordMatches) {
      req.log.warn(
        {
          user_id: user.id,
          status: "failed",
          error: "invalid credentials",
        },
        "user_login_failed"
      );
      throw unauthorized("invalid email or password");
    }

    req.log.info(
      {
        user_id: user.id,
        status: "success",
      },
      "user_logged_in"
    );

    const safeUser = publicUser(user);

    res.json({
      user: safeUser,
      token: createToken(safeUser),
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

module.exports = router;
