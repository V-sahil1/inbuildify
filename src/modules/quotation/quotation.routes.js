import express from "express";

const router = express.Router();

import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { validateExternalToken } from "../../middleware/externalAuthMiddleware.js";
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

// External Structural Engineer Upload Routes
// External engineers do not have an active session/JWT — these routes are
// secured by validateExternalToken (encrypted, 5-minute time-sensitive token).
router.post(
  "/version/:quotation_version_id/structure-engineer-report",
  validateExternalToken,
  createPdfUpload("quotation-structure-engineer-reports", 10 * 1024 * 1024).single("pdf"),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateQuotationVersionParamsSchema, REQUEST_SOURCE.PARAMS),
  quotationController.uploadStructureEngineerReport,
);

// External read endpoint used by the public upload page to render builder
// name and property details before the engineer submits their report.
router.get(
  "/version/:quotation_version_id/public-details",
  validateExternalToken,
  quotationController.getPublicDetailsByVersionId,
);

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

router.get(
  "/version/:quotation_id",
  validateRequest(deleteQuotationSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(getQuotationVersionsQuerySchema, REQUEST_SOURCE.QUERY),
  quotationController.getQuotationVersions,
);

router.get(
  "/lead/:leads_id",
  validateRequest(compareQuotationVersionsParamsSchema, REQUEST_SOURCE.PARAMS),
  quotationController.getQuotationsByLeadId,
);

router.post(
  "/:leads_id",
  validateRequest(createQuotationSchema, REQUEST_SOURCE.PARAMS),
  quotationController.createQuotation,
);

router.get(
  "/version-details/:quotation_version_id",
  validateRequest(updateQuotationVersionParamsSchema, REQUEST_SOURCE.PARAMS),
  quotationController.getQuotationVersionById,
);

router.get(
  "/:quotation_id",
  validateRequest(deleteQuotationSchema, REQUEST_SOURCE.PARAMS),
  quotationController.getQuotationById,
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
  quotationController.removePackageFromVersion,
);

router.get(
  "/version/:quotation_version_id/pdf",
  validateRequest(updateQuotationVersionParamsSchema, REQUEST_SOURCE.PARAMS),
  quotationController.previewPDF,
);

router.post(
  "/version/:quotation_version_id/send",
  validateRequest(updateQuotationVersionParamsSchema, REQUEST_SOURCE.PARAMS),
  quotationController.sendQuotationEmail,
);

router.post(
  "/version/:quotation_version_id/send-engineer-email",
  validateRequest(updateQuotationVersionParamsSchema, REQUEST_SOURCE.PARAMS),
  quotationController.sendEngineerEmail,
);

export default router;
