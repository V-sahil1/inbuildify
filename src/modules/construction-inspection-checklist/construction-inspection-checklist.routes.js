import express from "express";

const router = express.Router();

import {
  createConstructionInspectionChecklist,
  getConstructionInspectionChecklists,
  updateConstructionInspectionChecklist,
  deleteConstructionInspectionChecklist,
  getConstructionInspectionChecklistById,
} from "./construction-inspection-checklist.controller";
import {
  createConstructionInspectionChecklistSchema,
  getConstructionInspectionChecklistsSchema,
  updateConstructionInspectionChecklistSchema,
  deleteConstructionInspectionChecklistSchema,
  updateExistingJobsSchema,
} from "./construction-inspection-checklist.validation";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import caseConverterMiddleware from "../../middleware/caseConverterMiddleware";
import { REQUEST_SOURCE } from "../../config/constants";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(caseConverterMiddleware);
router.post(
  "/",
  validateRequest(
    createConstructionInspectionChecklistSchema,
    REQUEST_SOURCE.BODY,
  ),
  createConstructionInspectionChecklist,
);

router.get(
  "/",
  validateRequest(
    getConstructionInspectionChecklistsSchema,
    REQUEST_SOURCE.QUERY,
  ),
  getConstructionInspectionChecklists,
);

router.get(
  "/:id",
  validateRequest(
    deleteConstructionInspectionChecklistSchema,
    REQUEST_SOURCE.PARAMS,
  ),
  getConstructionInspectionChecklistById,
);

router.put(
  "/:id",
  validateRequest(
    deleteConstructionInspectionChecklistSchema,
    REQUEST_SOURCE.PARAMS,
  ),
  validateRequest(
    updateConstructionInspectionChecklistSchema,
    REQUEST_SOURCE.BODY,
  ),
  updateConstructionInspectionChecklist,
);

router.delete(
  "/:id",
  validateRequest(updateExistingJobsSchema, REQUEST_SOURCE.BODY),
  validateRequest(
    deleteConstructionInspectionChecklistSchema,
    REQUEST_SOURCE.PARAMS,
  ),
  deleteConstructionInspectionChecklist,
);

export default router;
