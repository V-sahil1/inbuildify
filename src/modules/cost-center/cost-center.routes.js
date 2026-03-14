const express = require("express");
const router = express.Router();
const costCenterController = require("./cost-center.controller.js");
const {
  createCostCenterSchema,
  updateCostCenterSchema,
  costCenterParamsSchema,
  createCostCenterChecklistMapSchema,
  costCenterChecklistMapQuerySchema,
  costCenterChecklistMapParamsSchema,
  getAllCostCentersSchema,
} = require("./cost-center.validation.js");
const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createCostCenterSchema, REQUEST_SOURCE.BODY),
  costCenterController.createCostCenter,
);

router.get(
  "/",
  validateRequest(getAllCostCentersSchema, REQUEST_SOURCE.QUERY),
  costCenterController.getCostCenters,
);

//get cost center checklist map
router.get(
  "/checklist-map",
  validateRequest(costCenterChecklistMapQuerySchema, REQUEST_SOURCE.QUERY),
  costCenterController.getCostCenterChecklistMaps,
);

router.get(
  "/:cost_center_id",
  validateRequest(costCenterParamsSchema, REQUEST_SOURCE.PARAMS),
  costCenterController.getCostCenterById,
);

router.put(
  "/:cost_center_id",
  validateRequest(costCenterParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateCostCenterSchema, REQUEST_SOURCE.BODY),
  costCenterController.updateCostCenter,
);

router.put(
  "/is-active/:cost_center_id",
  validateRequest(costCenterParamsSchema, REQUEST_SOURCE.PARAMS),
  costCenterController.toggleCostCenterStatus,
);

router.delete(
  "/:cost_center_id",
  validateRequest(costCenterParamsSchema, REQUEST_SOURCE.PARAMS),
  costCenterController.deleteCostCenter,
);

// Cost Center Checklist Map Routes
router.post(
  "/checklist-map",
  validateRequest(createCostCenterChecklistMapSchema, REQUEST_SOURCE.BODY),
  costCenterController.createCostCenterChecklistMap,
);

router.delete(
  "/checklist-map/:id",
  validateRequest(costCenterChecklistMapParamsSchema, REQUEST_SOURCE.PARAMS),
  costCenterController.deleteCostCenterChecklistMap,
);

module.exports = router;
