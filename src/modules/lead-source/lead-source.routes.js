const express = require("express");
const router = express.Router();
const {
  createLeadSource,
  getLeadSources,
  getLeadSourceById,
  updateLeadSource,
  deleteLeadSource,
  updateLeadSourceIsActive,
} = require("./lead-source.controller.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const {
  createLeadSourceSchema,
  getLeadResourcesSchema,
  getLeadSourceByIdSchema,
  updateLeadSourceParamsSchema,
  updateLeadSourceSchema,
  deleteLeadSourceSchema,
  updateLeadSourceIsActiveSchema,
} = require("./leadSource.validation.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createLeadSourceSchema, REQUEST_SOURCE.BODY),
  createLeadSource
);
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

router.put(
  "/is-active/:lead_source_id",
  validateRequest(updateLeadSourceParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateLeadSourceIsActiveSchema, REQUEST_SOURCE.BODY),
  updateLeadSourceIsActive
);

module.exports = router;
