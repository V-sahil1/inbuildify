const express = require("express");
const router = express.Router();

const {
  createSchedulerSettings,
  getSchedulerSettings,
  updateSchedulerSettings,
} = require("../controllers/scheduler-setting.controller");
const {
  createSchedulerSettingsSchema,
  updateSchedulerSettingSchema,
} = require("../validations/scheduler-setting.validation");

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
