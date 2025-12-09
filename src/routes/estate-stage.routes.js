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

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createEstateStageSchema, REQUEST_SOURCE.BODY),
  createEstateStage
);

router.get(
  "/",
  validateRequest(getALLEstateStageSchema, REQUEST_SOURCE.QUERY),
  getAllEstateStages
);

router.delete(
  "/:estate_stage_id",
  validateRequest(deleteEstateStageSchema, REQUEST_SOURCE.PARAMS),
  deleteEstateStage
);

router.put(
  "/:estate_stage_id",
  validateRequest(updateEstateStageParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updsteEstateStageSchema, REQUEST_SOURCE.BODY),
  updateEstateStage
);

module.exports = router;
