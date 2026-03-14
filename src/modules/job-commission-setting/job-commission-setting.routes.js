const express = require("express");
const router = express.Router();

const {
  createJobCommissionSettings,
  updateJobCommissionSettings,
  getUserJobCommissionSettings,
} = require("./job-commission-setting.controller.js");
const {
  createJobCommissionSettingSchema,
  updateJobCommissionSettingParamsSchema,
  updateJobCommissionSettingSchema,
} = require("./job-commission-setting.validation.js");

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
  validateRequest(createJobCommissionSettingSchema, REQUEST_SOURCE.BODY),
  createJobCommissionSettings
);

router.get("/", getUserJobCommissionSettings);

router.put(
  "/",
  validateRequest(updateJobCommissionSettingSchema, REQUEST_SOURCE.BODY),
  updateJobCommissionSettings
);
module.exports = router;
