const express = require("express");
const router = express.Router();

const {
  createGeneralSetting,
  updateGeneralSettings,
  getUserGeneralSettings,
} = require("./general-setting.controller.js");
const {
  createGeneralSettigSchema,
  updateGeneralSettingsSchema,
} = require("./general-setting.validation.js");

const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");

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
