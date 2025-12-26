const express = require("express");
const router = express.Router();

const {
  createIntegrationSettings,
  updateIntegrationSettings,
  getUserIntegrationSettings,
} = require("../controllers/integration-setting.controller");
const {
  createIntegrationSettingsSchema,
  updateIntegrationSettingParamsSchema,
  updateIntegrationSettingSchema,
} = require("../validations/integration-setting.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createIntegrationSettingsSchema, REQUEST_SOURCE.BODY),
  createIntegrationSettings
);

router.get("/", getUserIntegrationSettings);

router.put(
  "/:integration_settings_id",
  validateRequest(updateIntegrationSettingParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateIntegrationSettingSchema, REQUEST_SOURCE.BODY),
  updateIntegrationSettings
);

module.exports = router;
