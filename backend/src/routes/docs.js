const router = require("express").Router();
const swaggerUi = require("swagger-ui-express");
const openapiSpec = require("../openapi");

router.get("/openapi.json", (req, res) => {
  res.json(openapiSpec);
});

router.use(
  "/",
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, {
    customSiteTitle: "PKL API Docs",
  }),
);

module.exports = router;
