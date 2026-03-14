const express = require("express");
const router = express.Router();

const {
  createJobColorSettingSchema,
  updateJobColorSettingSchema,
} = require("./job-color-setting.validation.js");
const {
  createJobColorSettings,
  updateJobColorSetting,
  getUserJobColorSettings,
} = require("./job-color-setting.controller.js");
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
  validateRequest(createJobColorSettingSchema, REQUEST_SOURCE.BODY),
  createJobColorSettings
);

router.get("/", getUserJobColorSettings);

router.put(
  "/",
  validateRequest(updateJobColorSettingSchema, REQUEST_SOURCE.BODY),
  updateJobColorSetting
);

module.exports = router;
