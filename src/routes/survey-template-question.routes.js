const express = require("express");
const router = express.Router();

const {
  createSurveyTemplateQuestion,
  getAllSurveyTemplateQuestions,
  deleteSurveyTemplateQuestion,
  updateSurveyTemplateQuestion,
} = require("../controllers/survey-template-question.controller");
const {
  createSurveyQuestionSchema,
  getAllSurveyTemplateQuestionSchema,
  deleteSurveyTemplateQuestionSchema,
  updateSurveyTemplateQuestionParamsSchema,
  updateSurveyTemplateQuestionSchema,
} = require("../validations/survey-template-question.validation");

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
  validateRequest(createSurveyQuestionSchema, REQUEST_SOURCE.BODY),
  createSurveyTemplateQuestion
);

router.get(
  "/",
  validateRequest(getAllSurveyTemplateQuestionSchema, REQUEST_SOURCE.QUERY),
  getAllSurveyTemplateQuestions
);

router.delete(
  "/:survey_question_id",
  validateRequest(deleteSurveyTemplateQuestionSchema, REQUEST_SOURCE.PARAMS),
  deleteSurveyTemplateQuestion
);

router.put(
  "/:survey_question_id",
  validateRequest(
    updateSurveyTemplateQuestionParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(updateSurveyTemplateQuestionSchema, REQUEST_SOURCE.BODY),
  updateSurveyTemplateQuestion
);
module.exports = router;
