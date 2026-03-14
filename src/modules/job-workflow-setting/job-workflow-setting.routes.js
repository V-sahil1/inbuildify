const express = require("express");
const router = express.Router();

const {
  createJobWorkflowSetting,
  updateJobColorSetting,
  getUserJobWorkflowSettings,
} = require("./job-workflow-setting.controller.js");
const {
  createJobWorkflowSettingSchema,
  updateJobWorkflowSettingSchema,
  updateJobWorkflowSettingParamsSchema,
} = require("./job-workflow-setting.validation.js");

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
  validateRequest(createJobWorkflowSettingSchema, REQUEST_SOURCE.BODY),
  createJobWorkflowSetting
);

router.get("/", getUserJobWorkflowSettings);

router.put(
  "/",
  validateRequest(updateJobWorkflowSettingSchema, REQUEST_SOURCE.BODY),
  updateJobColorSetting
);

module.exports = router;
