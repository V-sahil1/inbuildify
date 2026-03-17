import express from "express";

const router = express.Router();

import {
  createConstructionChecklist,
  getAllConstructionChecklists,
  getConstructionChecklistById,
  updateConstructionChecklist,
  deleteConstructionChecklist,
} from "./construction-checklist.controller.js";
import {
  createConstructionChecklistValidation,
  updateConstructionChecklistValidation,
  getConstructionChecklistByIdValidation,
  queryValidation,
} from "./construction-checklist.validation.js";
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
  validateRequest(createConstructionChecklistValidation, REQUEST_SOURCE.BODY),
  createConstructionChecklist,
);

router.get(
  "/",
  validateRequest(queryValidation, REQUEST_SOURCE.QUERY),
  getAllConstructionChecklists,
);

router.get(
  "/:construction_checklist_id",
  validateRequest(getConstructionChecklistByIdValidation, REQUEST_SOURCE.PARAMS),
  getConstructionChecklistById,
);

router.put(
  "/:construction_checklist_id",
  validateRequest(getConstructionChecklistByIdValidation, REQUEST_SOURCE.PARAMS),
  validateRequest(updateConstructionChecklistValidation, REQUEST_SOURCE.BODY),
  updateConstructionChecklist,
);

router.delete(
  "/:construction_checklist_id",
  validateRequest(getConstructionChecklistByIdValidation, REQUEST_SOURCE.PARAMS),
  deleteConstructionChecklist,
);

export default router;
