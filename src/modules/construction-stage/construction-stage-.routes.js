import express from "express";

const router = express.Router();

import {
  createConstructionStage,
  getAllConstructionStages,
  deleteConstructionStage,
  updateConstructionStage,
} from "./construction-stage.controller.js";
import {
  createConstructionStageSchema,
  getAllConstructionStageSchema,
  deleteConstructionStageSchema,
  updateConstructionStageParamsSchema,
  updateConstructionStageSchema,
} from "./construction-stage.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(camelToSnakeMiddleware);
router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createConstructionStageSchema, REQUEST_SOURCE.BODY),
  createConstructionStage,
);

router.get(
  "/",
  validateRequest(getAllConstructionStageSchema, REQUEST_SOURCE.QUERY),
  getAllConstructionStages,
);

router.put(
  "/:construction_stage",
  validateRequest(updateConstructionStageParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateConstructionStageSchema, REQUEST_SOURCE.BODY),
  updateConstructionStage,
);

router.delete(
  "/:construction_stage",
  validateRequest(deleteConstructionStageSchema, REQUEST_SOURCE.PARAMS),
  deleteConstructionStage,
);

export default router;
