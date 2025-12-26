const express = require("express");
const router = express.Router();

const {
  createJobWorkflowSetting,
  updateJobColorSetting,
  getUserJobWorkflowSettings,
} = require("../controllers/job-workflow-setting.controller");
const {
  createJobWorkflowSettingSchema,
  updateJobWorkflowSettingSchema,
  updateJobWorkflowSettingParamsSchema,
} = require("../validations/job-workflow-setting.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createJobWorkflowSettingSchema, REQUEST_SOURCE.BODY),
  createJobWorkflowSetting
);

router.get("/", getUserJobWorkflowSettings);

router.put(
  "/:id",
  validateRequest(updateJobWorkflowSettingParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateJobWorkflowSettingSchema, REQUEST_SOURCE.BODY),
  updateJobColorSetting
);

module.exports = router;
