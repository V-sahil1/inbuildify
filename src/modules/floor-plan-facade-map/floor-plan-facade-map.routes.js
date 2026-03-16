import express from "express";

const router = express.Router();

import floorPlanFacadeMapController from "./floor-plan-facade-map.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import {
  createFloorPlanFacadeMapSchema,
  getFloorPlanFacadeMapsSchema,
  deleteFloorPlanFacadeMapSchema,
} from "./floor-plan-facade-map.validation";
import { REQUEST_SOURCE } from "../../config/constants";

router.post(
  "/",
  camelToSnakeMiddleware,
  authMiddleware,
  roleMiddleware,
  validateRequest(createFloorPlanFacadeMapSchema, REQUEST_SOURCE.BODY),
  floorPlanFacadeMapController.createFloorPlanFacadeMap,
);

router.get(
  "/",
  authMiddleware,
  roleMiddleware,
  validateRequest(getFloorPlanFacadeMapsSchema, REQUEST_SOURCE.QUERY),
  floorPlanFacadeMapController.getFloorPlanFacadeMaps,
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware,
  validateRequest(deleteFloorPlanFacadeMapSchema, REQUEST_SOURCE.PARAMS),
  floorPlanFacadeMapController.deleteFloorPlanFacadeMap,
);

export default router;
