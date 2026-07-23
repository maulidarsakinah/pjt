const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
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
const { buildListResponse, parsePagination } = require("../utils/pagination");
const { parsePositiveInteger } = require("../utils/validation");

router.use(authenticate);

router.get("/accesses", requirePermission("list accesses"), async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const accesses = await listUserAccesses(pagination);

    res.json(buildListResponse(accesses, pagination));
  } catch (error) {
    next(error);
  }
});

router.get("/:id/access", requirePermission("view accesses"), async (req, res, next) => {
  try {
    const userId = parsePositiveInteger(req.params.id);

    res.json(await getUserAccessDetails(userId));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/roles/:roleId", requirePermission("create accesses"), async (req, res, next) => {
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
});

router.delete("/:id/roles/:roleId", requirePermission("delete accesses"), async (req, res, next) => {
  try {
    const userId = parsePositiveInteger(req.params.id);
    const roleId = parsePositiveInteger(req.params.roleId, "role_id");

    await removeUserRole(req.user.id, userId, roleId, req);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.put("/:id/roles", requirePermission("update accesses"), async (req, res, next) => {
  try {
    const userId = parsePositiveInteger(req.params.id);
    const roles = await replaceUserRoles(req.user.id, userId, req.body.role_ids, req);

    res.json({
      data: roles,
      count: roles.length,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/permissions/:permissionId", requirePermission("create accesses"), async (req, res, next) => {
  try {
    const userId = parsePositiveInteger(req.params.id);
    const permissionId = parsePositiveInteger(req.params.permissionId, "permission_id");
    const permissions = await assignUserPermission(req.user.id, userId, permissionId, req);

    res.status(201).json({
      data: permissions,
      count: permissions.length,
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id/permissions/:permissionId", requirePermission("delete accesses"), async (req, res, next) => {
  try {
    const userId = parsePositiveInteger(req.params.id);
    const permissionId = parsePositiveInteger(req.params.permissionId, "permission_id");

    await removeUserPermission(req.user.id, userId, permissionId, req);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.put("/:id/permissions", requirePermission("update accesses"), async (req, res, next) => {
  try {
    const userId = parsePositiveInteger(req.params.id);
    const permissions = await replaceUserPermissions(
      req.user.id,
      userId,
      req.body.permission_ids,
      req
    );

    res.json({
      data: permissions,
      count: permissions.length,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
