const express = require("express");
const router = express.Router();

const {
  updateSalesModuleSettings,
  getSalesModuleSetting,
} = require("../controllers/sales-module-setting.controller");
const {
  updateSalesModuleSettingSchema,
} = require("../validations/sales-module-setting.validation");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

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
