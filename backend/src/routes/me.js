const bcrypt = require("bcryptjs");
const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const { getUserAccess } = require("../services/access");
const db = require("../db");
const { badRequest } = require("../utils/httpErrors");

router.use(authenticate);

router.get("/", async (req, res, next) => {
  let connection;

  try {
    const access = await getUserAccess(req.user.id);
    let company = null;

    if (req.user.company_id) {
      connection = await db.getConnection();
      const result = await connection.execute(
        `SELECT
           "id" AS "id",
           "name" AS "name",
           "address" AS "address",
           "contact" AS "contact"
         FROM "companies"
         WHERE "id" = :id
         AND ROWNUM = 1`,
        { id: req.user.company_id },
        {
          fetchArraySize: 1,
          maxRows: 1,
        }
      );

      company = result.rows[0] || null;
    }

    res.json({
      data: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
        status: req.user.status,
        company_id: req.user.company_id,
        company,
        roles: access.roles,
        permissions: access.permissions,
      },
    });
  } catch (error) {
    next(error);
  } finally {
    if (connection) {
      await connection.close();
    }
  }
});

router.get("/access", async (req, res, next) => {
  try {
    res.json(await getUserAccess(req.user.id));
  } catch (error) {
    next(error);
  }
});

router.patch("/password", async (req, res, next) => {
  let connection;

  try {
    const {
      current_password: currentPassword,
      new_password: newPassword,
      new_password_confirmation: newPasswordConfirmation,
    } = req.body;

    if (
      typeof currentPassword !== "string" ||
      typeof newPassword !== "string" ||
      typeof newPasswordConfirmation !== "string"
    ) {
      throw badRequest("current_password, new_password, and new_password_confirmation are required");
    }

    if (!currentPassword || !newPassword || !newPasswordConfirmation) {
      throw badRequest("current_password, new_password, and new_password_confirmation are required");
    }

    if (currentPassword.length > 255 || newPassword.length > 255) {
      throw badRequest("password must be 255 characters or less");
    }

    if (newPassword.length < 8) {
      throw badRequest("new_password must be at least 8 characters");
    }

    if (newPassword !== newPasswordConfirmation) {
      throw badRequest("new_password_confirmation must match new_password");
    }

    if (currentPassword === newPassword) {
      throw badRequest("new_password must be different from current_password");
    }

    connection = await db.getConnection();

    const result = await connection.execute(
      `SELECT "password" AS "password"
       FROM "users"
       WHERE "id" = :id
       AND "status" = '1'
       AND ROWNUM = 1`,
      { id: req.user.id },
      {
        fetchArraySize: 1,
        maxRows: 1,
      }
    );

    const user = result.rows[0];

    if (!user) {
      const error = new Error("Missing or invalid token");
      error.statusCode = 401;
      error.publicMessage = "Missing or invalid token";
      error.publicCode = "UNAUTHORIZED";
      throw error;
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.password);

    if (!passwordMatches) {
      req.log.warn(
        {
          user_id: req.user.id,
          status: "failed",
          reason: "invalid current password",
        },
        "user_password_change_failed"
      );
      throw badRequest("current_password is incorrect");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await connection.execute(
      `UPDATE "users"
       SET "password" = :password,
           "updated_at" = SYSTIMESTAMP
       WHERE "id" = :id`,
      {
        id: req.user.id,
        password: hashedPassword,
      },
      { autoCommit: true }
    );

    authenticate.invalidateUser(req.user.id);

    req.log.info(
      {
        user_id: req.user.id,
        status: "success",
      },
      "user_password_changed"
    );

    res.json({
      message: "password updated",
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
