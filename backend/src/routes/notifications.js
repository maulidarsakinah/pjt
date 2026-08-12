const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const {
  evaluateNotificationsInternal,
  getNotificationSummary,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} = require("../services/notifications");

router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    const result = await listNotifications(req.query, req.user.id);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/summary", async (req, res, next) => {
  try {
    const result = await getNotificationSummary(req.user.id);
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/read", async (req, res, next) => {
  try {
    await markNotificationRead(req.params.id, req.user.id);
    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    next(error);
  }
});

router.post("/read-all", async (req, res, next) => {
  try {
    await markAllNotificationsRead(req.user.id);
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    next(error);
  }
});

router.post("/evaluate", async (req, res, next) => {
  try {
    const result = await evaluateNotificationsInternal();
    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
