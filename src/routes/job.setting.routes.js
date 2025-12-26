const express = require("express");
const router = express.Router();

const {
  createJobSettings,
  updateJobSettings,
  getUserJobSettings,
} = require("../controllers/job-setting.controller");
const {
  createJobSettingsSchema,
  updateJobSettingParamsSchema,
  updateJobSettingSchema,
} = require("../validations/job-setting.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createJobSettingsSchema, REQUEST_SOURCE.BODY),
  createJobSettings
);

router.get("/", getUserJobSettings);

router.put(
  "/:job_settings_id",
  validateRequest(updateJobSettingParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateJobSettingSchema, REQUEST_SOURCE.BODY),
  updateJobSettings
);

module.exports = router;
