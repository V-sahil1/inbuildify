import express from "express";

const router = express.Router();

import {
  createInvoice,
  getInvoicesByLead,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
} from "./invoice.controller.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import {
  createInvoiceSchema,
  getInvoiceByIdSchema,
  getInvoicesByLeadSchema,
  updateInvoiceSchema,
} from "./invoice.validation.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createInvoiceSchema, REQUEST_SOURCE.BODY),
  createInvoice,
);

router.get(
  "/lead/:leads_id",
  validateRequest(getInvoicesByLeadSchema, REQUEST_SOURCE.PARAMS),
  getInvoicesByLead,
);

router.get(
  "/:invoice_id",
  validateRequest(getInvoiceByIdSchema, REQUEST_SOURCE.PARAMS),
  getInvoiceById,
);

router.put(
  "/:invoice_id",
  validateRequest(getInvoiceByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateInvoiceSchema, REQUEST_SOURCE.BODY),
  updateInvoice,
);

router.delete(
  "/:invoice_id",
  validateRequest(getInvoiceByIdSchema, REQUEST_SOURCE.PARAMS),
  deleteInvoice,
);

export default router;
