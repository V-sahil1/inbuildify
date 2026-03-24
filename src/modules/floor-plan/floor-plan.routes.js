import express from "express";

const router = express.Router();

import {
  createFloorPlan,
  getFloorPlans,
  updateFloorPlan,
  deleteFloorPlan,
  getFloorPlanFilters,
} from "./floor-plan.controller.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { createUpload, handleMulterError } from "../../utils/s3Upload.js";
import {
  createFloorPlanSchema,
  getFloorPlansSchema,
  updateFloorPlanParamsSchema,
  updateFloorPlanSchema,
  deleteFloorPlanSchema,
} from "./floor-plan.validation.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("floor-plans");

router.post(
  "/",
  upload.fields([
    { name: "detailedImage", maxCount: 1 },
    { name: "simpleImage", maxCount: 1 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createFloorPlanSchema, REQUEST_SOURCE.FORM_DATA),
  createFloorPlan,
);

router.get(
  "/",
  camelToSnakeMiddleware,
  validateRequest(getFloorPlansSchema, REQUEST_SOURCE.QUERY),
  getFloorPlans,
);

router.get("/filters", getFloorPlanFilters);

router.put(
  "/:floor_plan_id",
  upload.fields([
    { name: "detailedImage", maxCount: 1 },
    { name: "simpleImage", maxCount: 1 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateFloorPlanParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateFloorPlanSchema, REQUEST_SOURCE.FORM_DATA),
  updateFloorPlan,
);

router.delete(
  "/:floor_plan_id",
  camelToSnakeMiddleware,
  validateRequest(deleteFloorPlanSchema, REQUEST_SOURCE.PARAMS),
  deleteFloorPlan,
);

export default router;
