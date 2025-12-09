const express = require("express");
const router = express.Router();

const {
  createJobInvoiceSetting,
  getJobInvoiceSetting,
  updateJobInvoiceSetting,
} = require("../controllers/job-invoice-setting.controller");
const {
  createJobInvocieSettingSchema,
  updateJobInvoiceSettingParamsSchema,
  updateJobInvoiceSettingSchema,
} = require("../validations/job-invoice-setting.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createJobInvocieSettingSchema, REQUEST_SOURCE.BODY),
  createJobInvoiceSetting
);

router.get("/", getJobInvoiceSetting);

router.put(
  "/:id",
  validateRequest(updateJobInvoiceSettingParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateJobInvoiceSettingSchema, REQUEST_SOURCE.BODY),
  updateJobInvoiceSetting
);

module.exports = router;
