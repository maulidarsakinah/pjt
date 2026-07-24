const router = require("express").Router();
const { clearAuthCookie, setAuthCookie } = require("../authCookie");
const { authRateLimit } = require("../middleware/security");
const { loginUser, registerUser } = require("../services/auth");

router.post("/register", authRateLimit, async (req, res, next) => {
  try {
    const result = await registerUser(req.body, req);

    setAuthCookie(res, result.token);
    res.status(201).json({ user: result.user });
  } catch (error) {
    next(error);
  }
});

router.post("/login", authRateLimit, async (req, res, next) => {
  try {
    const result = await loginUser(req.body, req);

    setAuthCookie(res, result.token);
    res.json({ user: result.user });
  } catch (error) {
    next(error);
  }
});

router.post("/logout", (req, res) => {
  clearAuthCookie(res);
  res.status(204).send();
});

module.exports = router;
