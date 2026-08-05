const router = require("express").Router();
const { getBearerToken, verifyAccessToken } = require("../authToken");
const { authRateLimit } = require("../middleware/security");
const {
  loginUser,
  refreshUserSession,
  registerUser,
} = require("../services/auth");
const {
  clearRefreshCookie,
  getRefreshToken,
  setRefreshCookie,
  verifyRefreshToken,
} = require("../refreshToken");
const { revokeToken } = require("../tokenRevocation");

function noRefreshToken() {
  const error = new Error("refresh token is required");

  error.statusCode = 401;
  error.publicMessage = "Authentication session is unavailable";
  error.publicCode = "UNAUTHORIZED";
  return error;
}

function sendSession(res, result, statusCode = 200) {
  const { refreshToken, ...response } = result;

  setRefreshCookie(res, refreshToken);
  res.setHeader("Cache-Control", "no-store");
  res.status(statusCode).json(response);
}

router.post("/register", authRateLimit, async (req, res, next) => {
  try {
    const result = await registerUser(req.body, req);

    sendSession(res, result, 201);
  } catch (error) {
    next(error);
  }
});

router.post("/login", authRateLimit, async (req, res, next) => {
  try {
    const result = await loginUser(req.body, req);

    sendSession(res, result);
  } catch (error) {
    next(error);
  }
});

router.post("/refresh", authRateLimit, async (req, res, next) => {
  try {
    const token = getRefreshToken(req);

    if (!token) {
      throw noRefreshToken();
    }

    sendSession(res, await refreshUserSession(token));
  } catch (error) {
    clearRefreshCookie(res);
    next(error);
  }
});

router.post("/logout", (req, res) => {
  const accessToken = getBearerToken(req);
  const refreshToken = getRefreshToken(req);

  if (accessToken) {
    try {
      revokeToken(verifyAccessToken(accessToken));
    } catch (error) {
      req.log?.debug(
        { error_code: error.name },
        "logout_access_token_not_revoked",
      );
    }
  }

  if (refreshToken) {
    try {
      revokeToken(verifyRefreshToken(refreshToken));
    } catch (error) {
      req.log?.debug(
        { error_code: error.name },
        "logout_refresh_token_not_revoked",
      );
    }
  }

  clearRefreshCookie(res);
  res.status(204).send();
});

module.exports = router;
