const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const {
  clearCache,
  getFlowStationData,
  invalidateStation,
  listFlowStations,
  listMasterStations,
  createMasterStation,
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

router.post("/master", requirePermission("create stations"), async (req, res, next) => {
  try {
    res.status(201).json(await createMasterStation(req.body));
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

module.exports = router;
module.exports.invalidateStation = invalidateStation;
module.exports.clearCache = clearCache;
