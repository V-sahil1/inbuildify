const express = require("express");
const router = express.Router();

const {
  createMaintenanceSettings,
  updateMaintenanceSettings,
  getUserMaintenanceSettings,
} = require("../controllers/maintenance-setting.controller");
const {
  createMaintenanceSettingSchema,
  updateMaintenanceSettingParamsSchema,
  updateMaintenanceSettingSchema,
} = require("../validations/maintenance-setting.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createMaintenanceSettingSchema, REQUEST_SOURCE.BODY),
  createMaintenanceSettings
);

router.get("/", getUserMaintenanceSettings);

router.put(
  "/:maintenance_settings_id",
  validateRequest(updateMaintenanceSettingParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateMaintenanceSettingSchema, REQUEST_SOURCE.BODY),
  updateMaintenanceSettings
);

module.exports = router;
