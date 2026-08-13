const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const {
  listLogs,
  listTraceJourney,
  parseLogFilters,
} = require("../services/logs");
const { getUserIdentities } = require("../services/users");
const { parsePagination } = require("../utils/pagination");

router.use(authenticate);

async function enrichLogUsers(entries) {
  const identities = await getUserIdentities(
    entries.map((entry) => entry.user_id),
  );

  return entries.map((entry) => ({
    ...entry,
    user_name: identities.get(Number(entry.user_id)),
  }));
}

router.get(
  "/journey/:traceId",
  requirePermission("view logs"),
  async (req, res, next) => {
    try {
      const journey = await listTraceJourney(req.params.traceId);
      res.json({
        ...journey,
        data: await enrichLogUsers(journey.data),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.get("/", requirePermission("view logs"), async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 200,
    });
    const filters = parseLogFilters(req.query);

    const response = await listLogs({ pagination, filters });
    res.json({
      ...response,
      data: await enrichLogUsers(response.data),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
