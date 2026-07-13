const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const {
  clearCache,
  getFlowStationData,
  invalidateStation,
  listFlowStations,
} = require("../services/stations");

router.use(authenticate);

router.get("/flow", async (req, res, next) => {
  try {
    res.json(await listFlowStations(req.query));
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
