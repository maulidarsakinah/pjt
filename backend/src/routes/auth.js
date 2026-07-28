const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const { authRateLimit } = require("../middleware/security");
const { loginUser, registerUser } = require("../services/auth");
const { revokeToken } = require("../tokenRevocation");

router.post("/register", authRateLimit, async (req, res, next) => {
  try {
    const result = await registerUser(req.body, req);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/login", authRateLimit, async (req, res, next) => {
  try {
    const result = await loginUser(req.body, req);

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post("/logout", authenticate, (req, res) => {
  revokeToken(req.auth.payload);
  res.status(204).send();
});

module.exports = router;
