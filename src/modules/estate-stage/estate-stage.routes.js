import express from "express";

const router = express.Router();

import {
  createEstateStage,
  getAllEstateStages,
  deleteEstateStage,
  updateEstateStage,
} from "./estate-stage.controller.js";
import {
  createEstateStageSchema,
  getALLEstateStageSchema,
  deleteEstateStageSchema,
  updateEstateStageParamsSchema,
  updsteEstateStageSchema,
} from "./estate-stage.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { createImageOrPdfUpload, handleMulterError } from "../../utils/s3Upload.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);

// File upload middleware for estate stage attachments
const upload = createImageOrPdfUpload("estate-stage-attachments");

router.get(
  "/",
  camelToSnakeMiddleware,
  validateRequest(getALLEstateStageSchema, REQUEST_SOURCE.QUERY),
  getAllEstateStages,
);

router.post(
  "/",
  upload.fields([
    { name: "attachFile", maxCount: 10 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createEstateStageSchema, REQUEST_SOURCE.FORM_DATA),
  createEstateStage,
);

router.delete(
  "/:estate_stage_id",
  camelToSnakeMiddleware,
  validateRequest(deleteEstateStageSchema, REQUEST_SOURCE.PARAMS),
  deleteEstateStage,
);

router.put(
  "/:estate_stage_id",
  upload.fields([
    { name: "attachFile", maxCount: 10 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateEstateStageParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updsteEstateStageSchema, REQUEST_SOURCE.FORM_DATA),
  updateEstateStage,
);

export default router;
