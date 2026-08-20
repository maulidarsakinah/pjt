const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const {
  evaluateNotificationsInternal,
  getActiveAnomalySummary,
  getNotificationSummary,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} = require("../services/notifications");

router.use(authenticate);
router.use(requirePermission(["receive notifications", "view notifications"]));

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

router.get("/active-summary", async (_req, res, next) => {
  try {
    const result = await getActiveAnomalySummary();
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

const {
  send_notification_email,
  verify_smtp_connection,
} = require("../services/email_service");

router.post("/test-email", async (req, res, next) => {
  try {
    const recipient_email =
      req.body?.target_email && typeof req.body.target_email === "string"
        ? req.body.target_email.trim()
        : req.user?.email;

    if (!recipient_email) {
      return res.status(400).json({
        success: false,
        message: "recipient email is required (provide target_email in body or log in with a user having an email)",
      });
    }

    const smtp_status = await verify_smtp_connection();
    if (!smtp_status.configured) {
      return res.status(400).json({
        success: false,
        message:
          "Notifikasi email belum dikonfigurasi. Hubungi administrator untuk mengatur layanan email.",
      });
    }

    if (!smtp_status.success) {
      return res.status(503).json({
        success: false,
        message:
          "Layanan email sedang tidak tersedia. Periksa konfigurasi email lalu coba lagi.",
      });
    }

    const test_notification = {
      type: "info",
      title: "HydroTrack Test Notification",
      message: "This is a test notification email sent via Google SMTP to verify your email alert configuration.",
      metric_name: "test_metric",
      metric_value: 100,
      threshold_limit: 150,
      created_at: new Date(),
    };

    const email_sent = await send_notification_email(recipient_email, test_notification);

    if (email_sent) {
      res.json({
        success: true,
        message: `Test notification email successfully sent to ${recipient_email}`,
      });
    } else {
      res.status(502).json({
        success: false,
        message:
          "Layanan email tidak menerima pesan uji. Periksa alamat penerima dan konfigurasi email, lalu coba lagi.",
      });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;
