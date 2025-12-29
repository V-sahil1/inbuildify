const express = require("express");
const router = express.Router();

const {
  createQuotationSettings,
  getQuotationSettings,
  updateQuotationSettings,
  getQuotationSetting,
} = require("../controllers/quotation-setting.controller");
const {
  createQuotationSettingSchems,
  updateQuotationSettingParamsSchema,
  updateQuotationSettingSchema,
} = require("../validations/quotation-setting.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

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
