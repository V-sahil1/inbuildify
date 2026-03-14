const express = require("express");
const router = express.Router();

const {
  createQuotationSettings,
  getQuotationSettings,
  updateQuotationSettings,
  getQuotationSetting,
} = require("./quotation-setting.controller.js");
const {
  createQuotationSettingSchems,
  updateQuotationSettingParamsSchema,
  updateQuotationSettingSchema,
} = require("./quotation-setting.validation.js");

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
  validateRequest(createQuotationSettingSchems, REQUEST_SOURCE.BODY),
  createQuotationSettings
);

router.get("/fetch", getQuotationSetting);

router.get("/", getQuotationSettings);

router.put(
  "/:quotation_settings_id",
  validateRequest(updateQuotationSettingParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateQuotationSettingSchema, REQUEST_SOURCE.BODY),
  updateQuotationSettings
);

module.exports = router;
