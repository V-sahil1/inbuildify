const express = require("express");
const router = express.Router();

const {
  createConstructionSettings,
  getConstructionSettings,
  updateConstructionSettings,
} = require("./construction-setting.controller.js");
const {
  createConstructionSettingSchema,
  updateConstructionSettingSchema,
} = require("./construction-setting.validation.js");

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
  validateRequest(createConstructionSettingSchema, REQUEST_SOURCE.BODY),
  createConstructionSettings
);

router.get("/", getConstructionSettings);

router.put(
  "/",
  validateRequest(updateConstructionSettingSchema, REQUEST_SOURCE.BODY),
  updateConstructionSettings
);

module.exports = router;
