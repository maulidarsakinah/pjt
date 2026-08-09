const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const { idempotency } = require("../middleware/idempotency");
const { getUserAccess } = require("../services/access");
const { changeMyPassword, getMyProfile } = require("../services/me");

router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    res.json({
      data: await getMyProfile(req.user),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/access", async (req, res, next) => {
  try {
    res.json(await getUserAccess(req.user.id));
  } catch (error) {
    next(error);
  }
});

router.patch("/password", idempotency(), async (req, res, next) => {
  try {
    await changeMyPassword(req.user.id, req.body, req);

    res.json({
      message: "password updated",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
