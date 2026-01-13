const express = require("express");
const router = express.Router();
const costCenterController = require("../controllers/cost-center.controller");
const {
  createCostCenterSchema,
  updateCostCenterSchema,
  costCenterParamsSchema,
} = require("../validations/cost-center.validation");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createCostCenterSchema, REQUEST_SOURCE.BODY),
  costCenterController.createCostCenter
);

router.get("/", costCenterController.getCostCenters);

router.get(
  "/:cost_center_id",
  validateRequest(costCenterParamsSchema, REQUEST_SOURCE.PARAMS),
  costCenterController.getCostCenterById
);

router.put(
  "/:cost_center_id",
  validateRequest(costCenterParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateCostCenterSchema, REQUEST_SOURCE.BODY),
  costCenterController.updateCostCenter
);

router.put(
  "/is-active/:cost_center_id",
  validateRequest(costCenterParamsSchema, REQUEST_SOURCE.PARAMS),
  costCenterController.toggleCostCenterStatus
);

router.delete(
  "/:cost_center_id",
  validateRequest(costCenterParamsSchema, REQUEST_SOURCE.PARAMS),
  costCenterController.deleteCostCenter
);

module.exports = router;
