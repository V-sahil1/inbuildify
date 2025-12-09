const express = require("express");
const router = express.Router();

const {
  createSchedulerSettings,
  getSchedulerSettings,
  updateSchedulerSettings,
} = require("../controllers/scheduler-setting.controller");
const {
  createSchedulerSettingsSchema,
  updateSchedulerSettingParamsSchema,
  updateSchedulerSettingSchema,
} = require("../validations/scheduler-setting.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createSchedulerSettingsSchema, REQUEST_SOURCE.BODY),
  createSchedulerSettings
);

router.get("/", getSchedulerSettings);

router.put(
  "/:scheduler_settings_id",
  validateRequest(updateSchedulerSettingParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateSchedulerSettingSchema, REQUEST_SOURCE.BODY),
  updateSchedulerSettings
);

module.exports = router;
