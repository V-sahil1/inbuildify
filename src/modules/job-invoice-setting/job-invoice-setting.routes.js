const express = require("express");
const router = express.Router();

const {
  createJobInvoiceSetting,
  updateJobInvoiceSetting,
  getUserJobInvoiceSettings,
} = require("./job-invoice-setting.controller.js");
const {
  createJobInvocieSettingSchema,
  updateJobInvoiceSettingParamsSchema,
  updateJobInvoiceSettingSchema,
} = require("./job-invoice-setting.validation.js");

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
  validateRequest(createJobInvocieSettingSchema, REQUEST_SOURCE.BODY),
  createJobInvoiceSetting
);

router.get("/", getUserJobInvoiceSettings);

router.put(
  "/",
  validateRequest(updateJobInvoiceSettingSchema, REQUEST_SOURCE.BODY),
  updateJobInvoiceSetting
);

module.exports = router;
