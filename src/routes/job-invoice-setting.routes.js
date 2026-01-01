const express = require("express");
const router = express.Router();

const {
  createJobInvoiceSetting,
  updateJobInvoiceSetting,
  getUserJobInvoiceSettings,
} = require("../controllers/job-invoice-setting.controller");
const {
  createJobInvocieSettingSchema,
  updateJobInvoiceSettingParamsSchema,
  updateJobInvoiceSettingSchema,
} = require("../validations/job-invoice-setting.validation");

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
