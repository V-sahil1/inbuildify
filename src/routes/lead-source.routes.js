const express = require("express");
const router = express.Router();
const {
  createLeadSource,
  getLeadSources,
  getLeadSourceById,
  updateLeadSource,
  deleteLeadSource,
} = require("../controllers/lead-source.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  createLeadSourceSchema,
  getLeadResourcesSchema,
  getLeadSourceByIdSchema,
  updateLeadSourceParamsSchema,
  updateLeadSourceSchema,
  deleteLeadSourceSchema,
} = require("../validations/leadSource.validation.js");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/", validateRequest(createLeadSourceSchema), createLeadSource);
router.get(
  "/",
  validateRequest(getLeadResourcesSchema, REQUEST_SOURCE.QUERY),
  getLeadSources
);
router.get(
  "/:lead_source_id",
  validateRequest(getLeadSourceByIdSchema, REQUEST_SOURCE.PARAMS),
  getLeadSourceById
);
router.put(
  "/:lead_source_id",
  validateRequest(updateLeadSourceParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateLeadSourceSchema),
  updateLeadSource
);
router.delete(
  "/:lead_source_id",
  validateRequest(deleteLeadSourceSchema, REQUEST_SOURCE.PARAMS),
  deleteLeadSource
);

module.exports = router;
