const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const { idempotency } = require("../middleware/idempotency");
const {
  createRole,
  deleteRole,
  findRole,
  listRolePermissions,
  listRoles,
  replaceRolePermissions,
  updateRole,
} = require("../services/roles");
const { notFound } = require("../utils/httpErrors");
const { buildListResponse, parsePagination } = require("../utils/pagination");
const { parsePositiveInteger } = require("../utils/validation");

router.use(authenticate);

router.get("/", requirePermission("list roles"), async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const roles = await listRoles(pagination);

    res.json(buildListResponse(roles, pagination));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", requirePermission("view roles"), async (req, res, next) => {
  try {
    const id = parsePositiveInteger(req.params.id);
    const role = await findRole(id);

    if (!role) {
      throw notFound("role not found");
    }

    res.json({ data: role });
  } catch (error) {
    next(error);
  }
});

router.post("/", requirePermission("create roles"), idempotency(), async (req, res, next) => {
  try {
    res.status(201).json({ data: await createRole(req.body, req) });
  } catch (error) {
    next(error);
  }
});

function createUpdateRoleHandler({ partial }) {
  return async (req, res, next) => {
    try {
      const id = parsePositiveInteger(req.params.id);

      res.json({ data: await updateRole(id, req.body, req, { partial }) });
    } catch (error) {
      next(error);
    }
  };
}

router.put(
  "/:id",
  requirePermission("update roles"),
  idempotency(),
  createUpdateRoleHandler({ partial: false }),
);
router.patch(
  "/:id",
  requirePermission("update roles"),
  idempotency(),
  createUpdateRoleHandler({ partial: true }),
);

router.delete(
  "/:id",
  requirePermission("delete roles"),
  idempotency(),
  async (req, res, next) => {
    try {
      const id = parsePositiveInteger(req.params.id);

      await deleteRole(id, req);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/:id/permissions",
  requirePermission("view roles"),
  async (req, res, next) => {
    try {
      const id = parsePositiveInteger(req.params.id);
      const permissions = await listRolePermissions(id);

      res.json({
        data: permissions,
        count: permissions.length,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/:id/permissions",
  requirePermission("update roles"),
  idempotency(),
  async (req, res, next) => {
    try {
      const id = parsePositiveInteger(req.params.id);
      const permissions = await replaceRolePermissions(
        id,
        req.body.permission_ids,
        req,
      );

      res.json({
        data: permissions,
        count: permissions.length,
      });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
