const express = require("express");
const router = express.Router();

const {
  createSchedulerSettings,
  getSchedulerSettings,
  updateSchedulerSettings,
} = require("./scheduler-setting.controller.js");
const {
  createSchedulerSettingsSchema,
  updateSchedulerSettingSchema,
} = require("./scheduler-setting.validation.js");

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
  validateRequest(createSchedulerSettingsSchema, REQUEST_SOURCE.BODY),
  createSchedulerSettings
);

router.get("/", getSchedulerSettings);

router.put(
  "/",
  validateRequest(updateSchedulerSettingSchema, REQUEST_SOURCE.BODY),
  updateSchedulerSettings
);

module.exports = router;
