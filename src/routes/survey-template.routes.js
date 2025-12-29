const express = require("express");
const router = express.Router();

const {
  createSurveyTemplate,
  getAllSurveyTemplate,
  deleteSurveyTemplate,
  updateSurveyTemplate,
} = require("../controllers/survey-template.controller");
const {
  createSurveyTemplateSchema,
  getAllSurveyTemplateSchema,
  deleteSurveyTemplateSchema,
  updateSurveyTemplateParamsSchema,
  updateSurveyTemplateSchema,
} = require("../validations/survey-template.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createSurveyTemplateSchema, REQUEST_SOURCE.BODY),
  createSurveyTemplate
);

router.get(
  "/",
  validateRequest(getAllSurveyTemplateSchema, REQUEST_SOURCE.QUERY),
  getAllSurveyTemplate
);

router.delete(
  "/:survey_template_id",
  validateRequest(deleteSurveyTemplateSchema, REQUEST_SOURCE.PARAMS),
  deleteSurveyTemplate
);

router.put(
  "/:survey_template_id",
  validateRequest(updateSurveyTemplateParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSurveyTemplateSchema, REQUEST_SOURCE.BODY),
  updateSurveyTemplate
);
module.exports = router;
