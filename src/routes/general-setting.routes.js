const express = require("express");
const router = express.Router();

const {
  createGeneralSetting,
  updateGeneralSettings,
  getUserGeneralSettings,
} = require("../controllers/general-setting.controller");
const {
  createGeneralSettigSchema,
  updateGeneralSettingsSchema,
} = require("../validations/general-setting.validation");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createGeneralSettigSchema, REQUEST_SOURCE.BODY),
  createGeneralSetting
);

router.put(
  "/",
  validateRequest(updateGeneralSettingsSchema, REQUEST_SOURCE.BODY),
  updateGeneralSettings
);

router.get("/user", getUserGeneralSettings);

module.exports = router;
