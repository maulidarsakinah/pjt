const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const { idempotency } = require("../middleware/idempotency");
const { buildFieldChanges, writeAuditEvent } = require("../services/audit");
const {
  addThreshold,
  createAlat,
  deleteAlat,
  deleteThreshold,
  getAlatById,
  getAlatStatusDetail,
  listAlat,
  updateAlat,
  updateThreshold,
} = require("../services/alat");
const { evaluateNotificationsInternal } = require("../services/notifications");

router.use(authenticate);

router.get("/", async (req, res, next) => {
  try {
    res.json(await listAlat(req.query));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const data = await getAlatById(req.params.id);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/status", async (req, res, next) => {
  try {
    const data = await getAlatStatusDetail(req.params.id);
    res.json({ data });
  } catch (error) {
    next(error);
  }
});

router.post(
  "/",
  requirePermission("create stations"),
  idempotency(),
  async (req, res, next) => {
    try {
      const data = await createAlat(req.body);
      writeAuditEvent(req, {
        category: "station_admin",
        action: "create_master_alat",
        targetType: "tb_master_alat",
        targetId: data?.id,
      });
      evaluateNotificationsInternal().catch(() => {});
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/:id",
  requirePermission("update stations"),
  idempotency(),
  async (req, res, next) => {
    try {
      const result = await updateAlat(req.params.id, req.body, {
        partial: false,
      });
      writeAuditEvent(req, {
        category: "station_admin",
        action: "update_master_alat",
        targetType: "tb_master_alat",
        targetId: result.data?.id ?? req.params.id,
        changes: buildFieldChanges(
          result.before,
          result.data,
          Object.keys(req.body),
          { targetType: "alat" },
        ),
        metadata: { fields: Object.keys(req.body) },
      });
      if (result.before?.status !== result.data?.status) {
        evaluateNotificationsInternal().catch(() => {});
      }
      res.json({ data: result.data });
    } catch (error) {
      next(error);
    }
  },
);

router.patch(
  "/:id",
  requirePermission("update stations"),
  idempotency(),
  async (req, res, next) => {
    try {
      const result = await updateAlat(req.params.id, req.body, {
        partial: true,
      });
      writeAuditEvent(req, {
        category: "station_admin",
        action: "patch_master_alat",
        targetType: "tb_master_alat",
        targetId: result.data?.id ?? req.params.id,
        changes: buildFieldChanges(
          result.before,
          result.data,
          Object.keys(req.body),
          { targetType: "alat" },
        ),
        metadata: { fields: Object.keys(req.body) },
      });
      res.json({ data: result.data });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/:id",
  requirePermission("delete stations"),
  idempotency(),
  async (req, res, next) => {
    try {
      await deleteAlat(req.params.id);
      writeAuditEvent(req, {
        category: "station_admin",
        action: "delete_master_alat",
        targetType: "tb_master_alat",
        targetId: req.params.id,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/:id/thresholds",
  requirePermission("update stations"),
  idempotency(),
  async (req, res, next) => {
    try {
      const data = await addThreshold(req.params.id, req.body);
      writeAuditEvent(req, {
        category: "station_admin",
        action: "create_alat_threshold",
        targetType: "tb_alat_treshold",
        targetId: data?.id,
        metadata: { alat_id: req.params.id },
      });
      res.status(201).json({ data });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/:id/thresholds/:threshold_id",
  requirePermission("update stations"),
  idempotency(),
  async (req, res, next) => {
    try {
      const data = await updateThreshold(req.params.threshold_id, req.body);
      writeAuditEvent(req, {
        category: "station_admin",
        action: "update_alat_threshold",
        targetType: "tb_alat_treshold",
        targetId: req.params.threshold_id,
        metadata: { alat_id: req.params.id },
      });
      res.json({ data });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/:id/thresholds/:threshold_id",
  requirePermission("update stations"),
  idempotency(),
  async (req, res, next) => {
    try {
      await deleteThreshold(req.params.threshold_id);
      writeAuditEvent(req, {
        category: "station_admin",
        action: "delete_alat_threshold",
        targetType: "tb_alat_treshold",
        targetId: req.params.threshold_id,
        metadata: { alat_id: req.params.id },
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
