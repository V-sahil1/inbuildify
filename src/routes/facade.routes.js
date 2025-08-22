const express = require("express");
const router = express.Router();
const {
  createFacade,
  getFacades,
  getFacadeById,
  updateFacade,
  deleteFacade,
  getFacadeFilters
} = require("../controllers/facade.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  createFacadeSchema,
  getFacadeByIdSchema,
  getFacadesSchema,
  updateFacadeParamsSchema,
  updateFacadeSchema,
  deleteFacadeSchema
} = require("../validations/facade.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/", validateRequest(createFacadeSchema), createFacade);

router.get("/", validateRequest(getFacadesSchema, REQUEST_SOURCE.QUERY), getFacades);

router.get("/filters", getFacadeFilters);

router.get(
  "/:id",
  validateRequest(getFacadeByIdSchema, REQUEST_SOURCE.PARAMS),
  getFacadeById
);

router.put(
  "/:id",
  validateRequest(updateFacadeParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateFacadeSchema),
  updateFacade
);

router.delete(
  "/:id",
  validateRequest(deleteFacadeSchema, REQUEST_SOURCE.PARAMS),
  deleteFacade
);

module.exports = router;