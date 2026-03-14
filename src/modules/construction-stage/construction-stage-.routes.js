const express = require("express");
const router = express.Router();

const {
  createConstructionStage,
  getAllConstructionStages,
  deleteConstructionStage,
  updateConstructionStage,
} = require("./construction-stage.controller.js");
const {
  createConstructionStageSchema,
  getAllConstructionStageSchema,
  deleteConstructionStageSchema,
  updateConstructionStageParamsSchema,
  updateConstructionStageSchema,
} = require("./construction-stage.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(camelToSnakeMiddleware);
router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createConstructionStageSchema, REQUEST_SOURCE.BODY),
  createConstructionStage
);

router.get(
  "/",
  validateRequest(getAllConstructionStageSchema, REQUEST_SOURCE.QUERY),
  getAllConstructionStages
);

router.delete(
  "/:construction_stage",
  validateRequest(deleteConstructionStageSchema, REQUEST_SOURCE.PARAMS),
  deleteConstructionStage
);

router.put(
  "/:construction_stage",
  validateRequest(updateConstructionStageParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateConstructionStageSchema, REQUEST_SOURCE.BODY),
  updateConstructionStage
);

module.exports = router;
