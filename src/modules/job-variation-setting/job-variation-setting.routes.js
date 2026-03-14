const express = require("express");
const router = express.Router();

const {
  createJobVariationSettings,
  updateJobVariationSettings,
  getUserJobVariationSettings,
} = require("./job-variation-setting.controller.js");
const {
  createJobVariationSettingSchema,
  updateJobVariationSettingParamsSchema,
  updateJobVariationSettingSchema,
} = require("./job-variation-setting.validation.js");

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
  validateRequest(createJobVariationSettingSchema, REQUEST_SOURCE.BODY),
  createJobVariationSettings
);

router.get("/", getUserJobVariationSettings);

router.put(
  "/",
  validateRequest(updateJobVariationSettingSchema, REQUEST_SOURCE.BODY),
  updateJobVariationSettings
);

module.exports = router;
