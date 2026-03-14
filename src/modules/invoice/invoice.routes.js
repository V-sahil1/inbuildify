const express = require("express");
const router = express.Router();
const {
  createInvoice,
  getInvoicesByLead,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
} = require("./invoice.controller");

const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware");
const { validateRequest } = require("../../middleware/validateRequestMiddleware");

const {
  createInvoiceSchema,
  getInvoiceByIdSchema,
  getInvoicesByLeadSchema,
  updateInvoiceSchema,
} = require("./invoice.validation");
const { REQUEST_SOURCE } = require("../../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createInvoiceSchema, REQUEST_SOURCE.BODY),
  createInvoice
);

router.get(
  "/lead/:leads_id",
  validateRequest(getInvoicesByLeadSchema, REQUEST_SOURCE.PARAMS),
  getInvoicesByLead
);

router.get(
  "/:invoice_id",
  validateRequest(getInvoiceByIdSchema, REQUEST_SOURCE.PARAMS),
  getInvoiceById
);

router.put(
  "/:invoice_id",
  validateRequest(getInvoiceByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateInvoiceSchema, REQUEST_SOURCE.BODY),
  updateInvoice
);

router.delete(
  "/:invoice_id",
  validateRequest(getInvoiceByIdSchema, REQUEST_SOURCE.PARAMS),
  deleteInvoice
);

module.exports = router;
