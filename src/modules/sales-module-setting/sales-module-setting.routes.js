const express = require("express");
const router = express.Router();

const {
  updateSalesModuleSettings,
  getSalesModuleSetting,
} = require("./sales-module-setting.controller.js");
const {
  updateSalesModuleSettingSchema,
} = require("./sales-module-setting.validation.js");

const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.get("/fetch", getSalesModuleSetting);

router.put(
  "/",

  validateRequest(updateSalesModuleSettingSchema, REQUEST_SOURCE.BODY),
  updateSalesModuleSettings
);
module.exports = router;
