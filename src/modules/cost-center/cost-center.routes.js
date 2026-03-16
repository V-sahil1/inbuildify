import express from "express";

const router = express.Router();
import costCenterController from "./cost-center.controller.js";
import {
  createCostCenterSchema,
  updateCostCenterSchema,
  costCenterParamsSchema,
  createCostCenterChecklistMapSchema,
  costCenterChecklistMapQuerySchema,
  costCenterChecklistMapParamsSchema,
  getAllCostCentersSchema,
} from "./cost-center.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

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

export default router;
