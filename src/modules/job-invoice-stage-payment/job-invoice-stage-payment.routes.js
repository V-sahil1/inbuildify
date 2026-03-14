const express = require("express");
const router = express.Router();

const {
  createJobInvoiceStagePayment,
  getAllJobInvoiceStagePayments,
  deleteJobInvoiceStagePayment,
  updateJobInvoiceStagePayment,
} = require("./job-invoice-stage-payment.controller.js");
const {
  createJobInvoiceStagePaymentSchema,
  getAllJobInvoiceStagePaymentSchema,
  deleteJobInvoiceStagePaymentSchema,
  updateJobInvoiceStagePaymentParamsSchema,
  updateJobInvoiceStagePaymentSchema,
} = require("./job-invoice-stage-payment.validation.js");

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
  validateRequest(createJobInvoiceStagePaymentSchema, REQUEST_SOURCE.BODY),
  createJobInvoiceStagePayment
);

router.get(
  "/",
  validateRequest(getAllJobInvoiceStagePaymentSchema, REQUEST_SOURCE.QUERY),
  getAllJobInvoiceStagePayments
);

router.delete(
  "/:id",
  validateRequest(deleteJobInvoiceStagePaymentSchema, REQUEST_SOURCE.PARAMS),
  deleteJobInvoiceStagePayment
);

router.put(
  "/:job_invoice_stage_payment_id",
  validateRequest(
    updateJobInvoiceStagePaymentParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(updateJobInvoiceStagePaymentSchema, REQUEST_SOURCE.BODY),
  updateJobInvoiceStagePayment
);

module.exports = router;
