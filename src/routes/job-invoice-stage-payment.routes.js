const express = require("express");
const router = express.Router();

const {
  createJobInvoiceStagePayment,
  getAllJobInvoiceStagePayments,
  deleteJobInvoiceStagePayment,
  updateJobInvoiceStagePayment,
} = require("../controllers/job-invoice-stage-payment.controller");
const {
  createJobInvoiceStagePaymentSchema,
  getAllJobInvoiceStagePaymentSchema,
  deleteJobInvoiceStagePaymentSchema,
  updateJobInvoiceStagePaymentParamsSchema,
  updateJobInvoiceStagePaymentSchema,
} = require("../validations/job-invoice-stage-payment.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

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
