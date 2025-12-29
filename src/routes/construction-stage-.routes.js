const express = require("express");
const router = express.Router();

const {
  createConstructionStage,
  getAllConstructionStages,
  deleteConstructionStage,
  updateConstructionStage,
} = require("../controllers/construction-stage.controller");
const {
  createConstructionStageSchema,
  getAllConstructionStageSchema,
  deleteConstructionStageSchema,
  updateConstructionStageParamsSchema,
  updateConstructionStageSchema,
} = require("../validations/construction-stage.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

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
