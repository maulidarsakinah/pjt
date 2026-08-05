const { getUserAccess } = require("../services/access");
const { logJourneyStage } = require("./requestLogger");

function forbidden(message = "forbidden") {
  const error = new Error(message);
  error.statusCode = 403;
  error.publicMessage = "Missing required permission";
  error.publicCode = "FORBIDDEN";
  return error;
}

module.exports = (permission) => async (req, res, next) => {
  try {
    if (!req.user?.id) {
      throw forbidden();
    }

    const access = await getUserAccess(req.user.id);

    if (!access.permissions.includes(permission)) {
      throw forbidden(`missing permission: ${permission}`);
    }

    logJourneyStage(req, "authorization", "success", {
      required_permission: permission,
    });
    next();
  } catch (error) {
    logJourneyStage(req, "authorization", "failed", {
      required_permission: permission,
    });
    next(error);
  }
};
