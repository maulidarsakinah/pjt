const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const { idempotency } = require("../middleware/idempotency");
const { buildFieldChanges, writeAuditEvent } = require("../services/audit");
const {
  clearCache,
  deleteMasterStation,
  findMasterStation,
  getFlowStationData,
  invalidateStation,
  listFlowStations,
  listMasterStations,
  createMasterStation,
  updateMasterStation,
} = require("../services/stations");

router.use(authenticate);

router.get("/flow", async (req, res, next) => {
  try {
    res.json(await listFlowStations(req.query));
  } catch (error) {
    next(error);
  }
});

router.get("/master", async (req, res, next) => {
  try {
    res.json(await listMasterStations(req.query));
  } catch (error) {
    next(error);
  }
});

router.get("/master/:id", async (req, res, next) => {
  try {
    const row = await findMasterStation(req.params.id);
    res.json({ data: row });
  } catch (error) {
    next(error);
  }
});

router.post("/master", requirePermission("create stations"), idempotency(), async (req, res, next) => {
  try {
    const result = await createMasterStation(req.body);
    writeAuditEvent(req, {
      category: "station_admin",
      action: "create_master_station",
      targetType: "tb_master_station_position",
      targetId: result.data?.id,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.put("/master/:id", requirePermission("update stations"), idempotency(), async (req, res, next) => {
  try {
    const result = await updateMasterStation(req.params.id, req.body, { partial: false });
    writeAuditEvent(req, {
      category: "station_admin",
      action: "update_master_station",
      targetType: "tb_master_station_position",
      targetId: result.data?.id ?? req.params.id,
      changes: buildFieldChanges(result.before, result.data, Object.keys(req.body), { targetType: "station" }),
      metadata: { fields: Object.keys(req.body) },
    });
    res.json({ data: result.data });
  } catch (error) {
    next(error);
  }
});

router.patch("/master/:id", requirePermission("update stations"), idempotency(), async (req, res, next) => {
  try {
    const result = await updateMasterStation(req.params.id, req.body, { partial: true });
    writeAuditEvent(req, {
      category: "station_admin",
      action: "patch_master_station",
      targetType: "tb_master_station_position",
      targetId: result.data?.id ?? req.params.id,
      changes: buildFieldChanges(result.before, result.data, Object.keys(req.body), { targetType: "station" }),
      metadata: { fields: Object.keys(req.body) },
    });
    res.json({ data: result.data });
  } catch (error) {
    next(error);
  }
});

router.delete("/master/:id", requirePermission("delete stations"), idempotency(), async (req, res, next) => {
  try {
    await deleteMasterStation(req.params.id);
    writeAuditEvent(req, {
      category: "station_admin",
      action: "delete_master_station",
      targetType: "tb_master_station_position",
      targetId: req.params.id,
    });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.get("/flow/:id/data", async (req, res, next) => {
  try {
    res.json(await getFlowStationData(req.params.id, req.query));
  } catch (error) {
    next(error);
  }
});

router.get("/:id/columns", async (req, res, next) => {
  try {
    const { getStationColumns } = require("../services/alat");
    res.json({ data: await getStationColumns(req.params.id) });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.invalidateStation = invalidateStation;
module.exports.clearCache = clearCache;
