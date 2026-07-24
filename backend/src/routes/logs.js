const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const { listLogs, parseLogFilters } = require("../services/logs");
const { parsePagination } = require("../utils/pagination");

router.use(authenticate);

router.get("/", requirePermission("list accesses"), async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query, {
      defaultLimit: 50,
      maxLimit: 200,
    });
    const filters = parseLogFilters(req.query);

    res.json(await listLogs({ pagination, filters }));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
