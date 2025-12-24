const express = require("express");
const router = express.Router();

const {
  createSalesModuleSettings,
  getSalesModuleSettings,
  updateSalesModuleSettings,
  getSalesModuleSetting,
} = require("../controllers/sales-module-setting.controller");
const {
  createSalesModuleSettingsSchema,
  updateSalesModuleSettingSchema,
  updateSalesModuleSettingIdParamsSchema,
} = require("../validations/sales-module-setting.validation");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createSalesModuleSettingsSchema, REQUEST_SOURCE.BODY),
  createSalesModuleSettings
);

router.get("/fetch", getSalesModuleSetting);

router.get("/", getSalesModuleSettings);

router.put(
  "/:id",
  validateRequest(
    updateSalesModuleSettingIdParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(updateSalesModuleSettingSchema, REQUEST_SOURCE.BODY),
  updateSalesModuleSettings
);
module.exports = router;
