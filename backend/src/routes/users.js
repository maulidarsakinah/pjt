const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const { idempotency } = require("../middleware/idempotency");
const {
  assignUserPermission,
  assignUserRole,
  getUserAccessDetails,
  listUserAccesses,
  removeUserPermission,
  removeUserRole,
  replaceUserPermissions,
  replaceUserRoles,
} = require("../services/userAccess");
const {
  createUser,
  deleteUser,
  getUser,
  getUserSummary,
  listUsers,
  resetUserPassword,
  updateUser,
} = require("../services/users");
const { buildListResponse, parsePagination } = require("../utils/pagination");
const { parsePositiveInteger } = require("../utils/validation");

router.use(authenticate);

router.get("/", requirePermission("list users"), async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const result = await listUsers({
      ...pagination,
      search: req.query.search,
      roleId:
        req.query.role_id === undefined
          ? undefined
          : parsePositiveInteger(req.query.role_id, "role_id"),
      status: req.query.status,
      excludeUserId: req.user.id,
    });
    res.json({
      data: result.data,
      count: result.data.length,
      total: result.total,
      limit: pagination.limit,
      offset: pagination.offset,
      has_more: result.has_more,
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/summary",
  requirePermission("list users"),
  async (req, res, next) => {
    try {
      res.json({ data: await getUserSummary() });
    } catch (error) {
      next(error);
    }
  },
);

router.post("/", requirePermission("create users"), idempotency(), async (req, res, next) => {
  try {
    res.status(201).json({ data: await createUser(req.body, req.user, req) });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/accesses",
  requirePermission("view logs"),
  async (req, res, next) => {
    try {
      const pagination = parsePagination(req.query);
      const accesses = await listUserAccesses(pagination);
      res.json(buildListResponse(accesses, pagination));
    } catch (error) {
      next(error);
    }
  },
);

router.get("/:id", requirePermission("view users"), async (req, res, next) => {
  try {
    const user = await getUser(parsePositiveInteger(req.params.id));
    if (!user)
      throw Object.assign(new Error("user not found"), {
        statusCode: 404,
        publicMessage: "User not found",
      });
    res.json({ data: user });
  } catch (error) {
    next(error);
  }
});

router.patch(
  "/:id",
  requirePermission("update users"),
  idempotency(),
  async (req, res, next) => {
    try {
      res.json({
        data: await updateUser(
          parsePositiveInteger(req.params.id),
          req.body,
          req,
        ),
      });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/:id",
  requirePermission("delete users"),
  idempotency(),
  async (req, res, next) => {
    try {
      await deleteUser(parsePositiveInteger(req.params.id), req.user.id, req);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/:id/reset-password",
  requirePermission("update users"),
  idempotency(),
  async (req, res, next) => {
    try {
      await resetUserPassword(
        parsePositiveInteger(req.params.id),
        req.body.password,
        req,
      );
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

router.get(
  "/:id/access",
  requirePermission("view accesses"),
  async (req, res, next) => {
    try {
      const userId = parsePositiveInteger(req.params.id);

      res.json(await getUserAccessDetails(userId));
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/:id/roles/:roleId",
  requirePermission("create accesses"),
  idempotency(),
  async (req, res, next) => {
    try {
      const userId = parsePositiveInteger(req.params.id);
      const roleId = parsePositiveInteger(req.params.roleId, "role_id");
      const roles = await assignUserRole(req.user.id, userId, roleId, req);

      res.status(201).json({
        data: roles,
        count: roles.length,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/:id/roles/:roleId",
  requirePermission("delete accesses"),
  idempotency(),
  async (req, res, next) => {
    try {
      const userId = parsePositiveInteger(req.params.id);
      const roleId = parsePositiveInteger(req.params.roleId, "role_id");

      await removeUserRole(req.user.id, userId, roleId, req);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/:id/roles",
  requirePermission("update accesses"),
  idempotency(),
  async (req, res, next) => {
    try {
      const userId = parsePositiveInteger(req.params.id);
      const roles = await replaceUserRoles(
        req.user.id,
        userId,
        req.body.role_ids,
        req,
      );

      res.json({
        data: roles,
        count: roles.length,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/:id/permissions/:permissionId",
  requirePermission("create accesses"),
  idempotency(),
  async (req, res, next) => {
    try {
      const userId = parsePositiveInteger(req.params.id);
      const permissionId = parsePositiveInteger(
        req.params.permissionId,
        "permission_id",
      );
      const permissions = await assignUserPermission(
        req.user.id,
        userId,
        permissionId,
        req,
      );

      res.status(201).json({
        data: permissions,
        count: permissions.length,
      });
    } catch (error) {
      next(error);
    }
  },
);

router.delete(
  "/:id/permissions/:permissionId",
  requirePermission("delete accesses"),
  idempotency(),
  async (req, res, next) => {
    try {
      const userId = parsePositiveInteger(req.params.id);
      const permissionId = parsePositiveInteger(
        req.params.permissionId,
        "permission_id",
      );

      await removeUserPermission(req.user.id, userId, permissionId, req);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

router.put(
  "/:id/permissions",
  requirePermission("update accesses"),
  idempotency(),
  async (req, res, next) => {
    try {
      const userId = parsePositiveInteger(req.params.id);
      const permissions = await replaceUserPermissions(
        req.user.id,
        userId,
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
