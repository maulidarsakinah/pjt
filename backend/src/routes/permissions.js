const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const {
  createPermission,
  deletePermission,
  findPermission,
  listPermissions,
  updatePermission,
} = require("../services/permissions");
const { notFound } = require("../utils/httpErrors");
const { buildListResponse, parsePagination } = require("../utils/pagination");
const { parsePositiveInteger } = require("../utils/validation");

router.use(authenticate);

router.get("/", requirePermission("list permissions"), async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const permissions = await listPermissions(pagination);

    res.json(buildListResponse(permissions, pagination));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requirePermission("view permissions"), async (req, res, next) => {
  try {
    const id = parsePositiveInteger(req.params.id);
    const permission = await findPermission(id);

    if (!permission) {
      throw notFound("permission not found");
    }

    res.json({ data: permission });
  } catch (error) {
    next(error);
  }
});

router.post("/", requirePermission("create permissions"), async (req, res, next) => {
  try {
    res.status(201).json({ data: await createPermission(req.body, req) });
  } catch (error) {
    next(error);
  }
});

function createUpdatePermissionHandler({ partial }) {
  return async (req, res, next) => {
    try {
      const id = parsePositiveInteger(req.params.id);

      res.json({ data: await updatePermission(id, req.body, req, { partial }) });
    } catch (error) {
      next(error);
    }
  };
}

router.put(
  "/:id",
  requirePermission("update permissions"),
  createUpdatePermissionHandler({ partial: false })
);
router.patch(
  "/:id",
  requirePermission("update permissions"),
  createUpdatePermissionHandler({ partial: true })
);

router.delete("/:id", requirePermission("delete permissions"), async (req, res, next) => {
  try {
    const id = parsePositiveInteger(req.params.id);

    await deletePermission(id, req);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
