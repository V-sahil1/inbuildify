const express = require("express");
const router = express.Router();

const {
  createSurveyor,
  getAllSurveyor,
  deleteSurveyor,
  updateSurveyor,
} = require("./surveyor.controller.js");
const {
  createSurveyorSchema,
  getAllServeyorSchema,
  deleteSurveyorSchema,
  updateSurveyorIdParamsSchema,
  updateSurveyorSchema,
} = require("./surveyor.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createSurveyorSchema, REQUEST_SOURCE.BODY),
  createSurveyor
);

router.get(
  "/",
  validateRequest(getAllServeyorSchema, REQUEST_SOURCE.QUERY),
  getAllSurveyor
);

router.delete(
  "/:surveyor_id",
  validateRequest(deleteSurveyorSchema, REQUEST_SOURCE.PARAMS),
  deleteSurveyor
);

router.put(
  "/:surveyor_id",
  validateRequest(updateSurveyorIdParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSurveyorSchema, REQUEST_SOURCE.BODY),
  updateSurveyor
);
module.exports = router;
