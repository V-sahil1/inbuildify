const express = require("express");
const router = express.Router();

const {
  createIntegrationSettings,
  updateIntegrationSettings,
  getUserIntegrationSettings,
} = require("./integration-setting.controller.js");
const {
  createIntegrationSettingsSchema,
  updateIntegrationSettingSchema,
} = require("./integration-setting.validation.js");

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
  validateRequest(createIntegrationSettingsSchema, REQUEST_SOURCE.BODY),
  createIntegrationSettings
);

router.get("/", getUserIntegrationSettings);

router.put(
  "/",
  validateRequest(updateIntegrationSettingSchema, REQUEST_SOURCE.BODY),
  updateIntegrationSettings
);

module.exports = router;
