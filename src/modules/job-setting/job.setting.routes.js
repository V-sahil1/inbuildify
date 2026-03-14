const express = require("express");
const router = express.Router();

const {
  createJobSettings,
  updateJobSettings,
  getUserJobSettings,
} = require("./job-setting.controller.js");
const {
  createJobSettingsSchema,
  updateJobSettingSchema,
} = require("./job-setting.validation.js");

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
  validateRequest(createJobSettingsSchema, REQUEST_SOURCE.BODY),
  createJobSettings
);

router.get("/", getUserJobSettings);

router.put(
  "/",
  validateRequest(updateJobSettingSchema, REQUEST_SOURCE.BODY),
  updateJobSettings
);

module.exports = router;
