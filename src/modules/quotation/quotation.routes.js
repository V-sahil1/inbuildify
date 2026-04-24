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
  compareQuotationVersionsBodySchema,
  removePackageFromVersionSchema,
  getQuotationVersionsQuerySchema,
} from "./quotation.validation.js";
import quotationController from "./quotation.controller.js";
import { createPdfUpload, handleMulterError } from "../../utils/s3Upload.js";

// Public route — no auth required; must be registered before auth middleware
router.get("/view/:hash", quotationController.viewQuotationByHash);

router.use(authMiddleware);
router.use(roleMiddleware);

// List all quotations (no lead filter) — must be before /:leads_id
router.get(
  "/",
  quotationController.getAllQuotations,
);

// Get quotation status counts
router.get(
  "/status-counts",
  quotationController.getQuotationStatusCounts,
);

// Quotation filter options
router.get(
  "/filter-options",
  quotationController.getQuotationFilterOptions,
);

router.post(
  "/compare/:leads_id",
  validateRequest(compareQuotationVersionsParamsSchema, REQUEST_SOURCE.PARAMS),
  camelToSnakeMiddleware,
  validateRequest(compareQuotationVersionsBodySchema, REQUEST_SOURCE.BODY),
  quotationController.compareQuotationVersions,
);

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
  validateRequest(getQuotationVersionsQuerySchema, REQUEST_SOURCE.QUERY),
  quotationController.getQuotationVersions,
);

router.get(
  "/version-details/:quotation_version_id",
  validateRequest(updateQuotationVersionParamsSchema, REQUEST_SOURCE.PARAMS),
  quotationController.getQuotationVersionById,
);

router.delete(
  "/:quotation_id",
  validateRequest(deleteQuotationSchema, REQUEST_SOURCE.PARAMS),
  quotationController.deleteQuotation,
);

router.put(
  "/version/:quotation_version_id",
  createPdfUpload("quotation-reports").single("uploadReport"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateQuotationVersionParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateQuotationVersionBodySchema, REQUEST_SOURCE.FORM_DATA),
  quotationController.updateQuotationVersion,
);

router.post(
  "/version/:quotation_version_id/duplicate",
  validateRequest(duplicateQuotationVersionSchema, REQUEST_SOURCE.PARAMS),
  camelToSnakeMiddleware,
  quotationController.duplicateQuotationVersion,
);

router.delete(
  "/version/:quotation_version_id/packages/:package_id",
  validateRequest(removePackageFromVersionSchema, REQUEST_SOURCE.PARAMS),
  camelToSnakeMiddleware,
  quotationController.removePackageFromVersion
);

router.get(
  "/version/:quotation_version_id/pdf",
  validateRequest(updateQuotationVersionParamsSchema, REQUEST_SOURCE.PARAMS),
  quotationController.previewPDF
);

router.post(
  "/version/:quotation_version_id/send",
  validateRequest(updateQuotationVersionParamsSchema, REQUEST_SOURCE.PARAMS),
  quotationController.sendQuotationEmail
);

export default router;
