import express from "express";

const router = express.Router();

import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";
import {
  createQuotationSchema,
  deleteQuotationSchema,
  updateQuotationVersionParamsSchema,
  updateQuotationVersionBodySchema,
  duplicateQuotationVersionSchema,
  compareQuotationVersionsParamsSchema,
  compareQuotationVersionsQuerySchema,
} from "./quotation.validation.js";
import quotationController from "./quotation.controller.js";

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/:leads_id",
  validateRequest(createQuotationSchema, REQUEST_SOURCE.PARAMS),
  camelToSnakeMiddleware,
  quotationController.createQuotation,
);

router.get(
  "/:leads_id",
  validateRequest(createQuotationSchema, REQUEST_SOURCE.PARAMS),
  quotationController.getQuotationsByLeadId,
);

router.get(
  "/version/:quotation_id",
  validateRequest(deleteQuotationSchema, REQUEST_SOURCE.PARAMS),
  quotationController.getQuotationVersions,
);

router.delete(
  "/:quotation_id",
  validateRequest(deleteQuotationSchema, REQUEST_SOURCE.PARAMS),
  quotationController.deleteQuotation,
);

router.put(
  "/version/:quotation_version_id",
  camelToSnakeMiddleware,
  validateRequest(updateQuotationVersionParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateQuotationVersionBodySchema, REQUEST_SOURCE.BODY),
  quotationController.updateQuotationVersion,
);

router.post(
  "/version/:quotation_version_id/duplicate",
  validateRequest(duplicateQuotationVersionSchema, REQUEST_SOURCE.PARAMS),
  camelToSnakeMiddleware,
  quotationController.duplicateQuotationVersion,
);

router.get(
  "/compare/:quotation_id",
  validateRequest(compareQuotationVersionsParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(compareQuotationVersionsQuerySchema, REQUEST_SOURCE.QUERY),
  quotationController.compareQuotationVersions,
);

export default router;
