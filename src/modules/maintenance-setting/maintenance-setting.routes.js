const express = require("express");
const router = express.Router();

const {
  createMaintenanceSettings,
  updateMaintenanceSettings,
  getUserMaintenanceSettings,
} = require("./maintenance-setting.controller.js");
const {
  createMaintenanceSettingSchema,
  updateMaintenanceSettingParamsSchema,
  updateMaintenanceSettingSchema,
} = require("./maintenance-setting.validation.js");

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
  validateRequest(createMaintenanceSettingSchema, REQUEST_SOURCE.BODY),
  createMaintenanceSettings
);

router.get("/", getUserMaintenanceSettings);

router.put(
  "/",
  validateRequest(updateMaintenanceSettingSchema, REQUEST_SOURCE.BODY),
  updateMaintenanceSettings
);

module.exports = router;
