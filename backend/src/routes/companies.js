const router = require("express").Router();
const authenticate = require("../middleware/authenticate");
const requirePermission = require("../middleware/requirePermission");
const {
  createCompany,
  deleteCompany,
  findCompany,
  listCompanies,
  updateCompany,
  validateCompanyPayload,
} = require("../services/companies");
const { buildFieldChanges, writeAuditEvent } = require("../services/audit");
const { badRequest, notFound } = require("../utils/httpErrors");
const { buildListResponse, parsePagination } = require("../utils/pagination");

function parseId(value) {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw badRequest("id must be a positive integer");
  }

  return id;
}

router.use(authenticate);

router.get("/", requirePermission("list companies"), async (req, res, next) => {
  try {
    const pagination = parsePagination(req.query);
    const companies = await listCompanies(pagination);

    res.json(buildListResponse(companies, pagination));
  } catch (error) {
    next(error);
  }
});

router.get(
  "/:id",
  requirePermission("view companies"),
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const company = await findCompany(id);

      if (!company) {
        throw notFound("company not found");
      }

      res.json({ data: company });
    } catch (error) {
      next(error);
    }
  },
);

router.post(
  "/",
  requirePermission("create companies"),
  async (req, res, next) => {
    try {
      const payload = validateCompanyPayload(req.body);
      const company = await createCompany(payload);

      writeAuditEvent(req, {
        category: "company_admin",
        action: "create_company",
        targetType: "company",
        targetId: company.id,
      });

      res.status(201).json({ data: company });
    } catch (error) {
      next(error);
    }
  },
);

function createUpdateCompanyHandler({ partial }) {
  return async (req, res, next) => {
    try {
      const id = parseId(req.params.id);
      const payload = validateCompanyPayload(req.body, { partial });
      const before = await findCompany(id);
      const company = await updateCompany(id, payload);

      writeAuditEvent(req, {
        category: "company_admin",
        action: "update_company",
        targetType: "company",
        targetId: id,
        changes: buildFieldChanges(before, company, Object.keys(payload), {
          targetType: "company",
        }),
        metadata: { fields: Object.keys(payload) },
      });

      res.json({ data: company });
    } catch (error) {
      next(error);
    }
  };
}

router.put(
  "/:id",
  requirePermission("update companies"),
  createUpdateCompanyHandler({ partial: false }),
);
router.patch(
  "/:id",
  requirePermission("update companies"),
  createUpdateCompanyHandler({ partial: true }),
);

router.delete(
  "/:id",
  requirePermission("delete companies"),
  async (req, res, next) => {
    try {
      const id = parseId(req.params.id);

      await deleteCompany(id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
