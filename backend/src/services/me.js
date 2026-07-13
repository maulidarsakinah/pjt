const bcrypt = require("bcryptjs");
const authenticate = require("../middleware/authenticate");
const { badRequest } = require("../utils/httpErrors");
const { getUserAccess } = require("./access");
const { writeAuditEvent } = require("./audit");
const { withConnection } = require("./database");

async function getMyProfile(user) {
  const access = await getUserAccess(user.id);

  return withConnection(async (connection) => {
    let company = null;

    if (user.company_id) {
      const result = await connection.execute(
        `SELECT
           "id" AS "id",
           "name" AS "name",
           "address" AS "address",
           "contact" AS "contact"
         FROM "companies"
         WHERE "id" = :id
         AND ROWNUM = 1`,
        { id: user.company_id },
        {
          fetchArraySize: 1,
          maxRows: 1,
        }
      );

      company = result.rows[0] || null;
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      status: user.status,
      company_id: user.company_id,
      company,
      roles: access.roles,
      permissions: access.permissions,
    };
  });
}

function validatePasswordChange(body) {
  const {
    current_password: currentPassword,
    new_password: newPassword,
    new_password_confirmation: newPasswordConfirmation,
  } = body;

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

  return {
    currentPassword,
    newPassword,
  };
}

function missingTokenError() {
  const error = new Error("Missing or invalid token");

  error.statusCode = 401;
  error.publicMessage = "Missing or invalid token";
  error.publicCode = "UNAUTHORIZED";
  return error;
}

async function changeMyPassword(userId, body, req) {
  const { currentPassword, newPassword } = validatePasswordChange(body);

  return withConnection(async (connection) => {
    const result = await connection.execute(
      `SELECT "password" AS "password"
       FROM "users"
       WHERE "id" = :id
       AND "status" = '1'
       AND ROWNUM = 1`,
      { id: userId },
      {
        fetchArraySize: 1,
        maxRows: 1,
      }
    );

    const user = result.rows[0];

    if (!user) {
      throw missingTokenError();
    }

    const passwordMatches = await bcrypt.compare(currentPassword, user.password);

    if (!passwordMatches) {
      writeAuditEvent(req, {
        category: "auth",
        action: "user_password_change",
        outcome: "failed",
        targetType: "user",
        targetId: userId,
        metadata: { reason: "invalid_current_password" },
      });
      throw badRequest("current_password is incorrect");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await connection.execute(
      `UPDATE "users"
       SET "password" = :password,
           "updated_at" = SYSTIMESTAMP
       WHERE "id" = :id`,
      {
        id: userId,
        password: hashedPassword,
      },
      { autoCommit: true }
    );

    authenticate.invalidateUser(userId);

    writeAuditEvent(req, {
      category: "auth",
      action: "user_password_change",
      targetType: "user",
      targetId: userId,
    });
  });
}

module.exports = {
  changeMyPassword,
  getMyProfile,
};
