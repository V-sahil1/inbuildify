const express = require("express");
const router = express.Router();

const {
  createEstateStage,
  getAllEstateStages,
  deleteEstateStage,
  updateEstateStage,
} = require("../controllers/estate-stage.controller");
const {
  createEstateStageSchema,
  getALLEstateStageSchema,
  deleteEstateStageSchema,
  updateEstateStageParamsSchema,
  updsteEstateStageSchema,
} = require("../validations/estate-stage.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");
const { createImageOrPdfUpload, handleMulterError } = require("../utils/s3Upload");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

// File upload middleware for estate stage attachments
const upload = createImageOrPdfUpload("estate-stage-attachments");

router.get(
  "/",
  camelToSnakeMiddleware,
  validateRequest(getALLEstateStageSchema, REQUEST_SOURCE.QUERY),
  getAllEstateStages
);

router.post(
  "/",
  upload.fields([
    { name: "attachFile", maxCount: 10},
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createEstateStageSchema, REQUEST_SOURCE.FORM_DATA),
  createEstateStage
);

router.delete(
  "/:estate_stage_id",
  camelToSnakeMiddleware,
  validateRequest(deleteEstateStageSchema, REQUEST_SOURCE.PARAMS),
  deleteEstateStage
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
  updateEstateStage
);

module.exports = router;
