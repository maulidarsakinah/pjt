const router = require("express").Router();
const { authRateLimit } = require("../middleware/security");
const { loginUser, registerUser } = require("../services/auth");

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
    res.json(await loginUser(req.body, req));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
