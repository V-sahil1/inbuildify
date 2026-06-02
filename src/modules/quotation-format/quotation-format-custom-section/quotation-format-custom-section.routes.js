import express from "express";
import {
  createQuotationFormatCustomSection,
  getQuotationFormatCustomSections,
  getQuotationFormatCustomSectionById,
  updateQuotationFormatCustomSection,
  deleteQuotationFormatCustomSection,
} from "./quotation-format-custom-section.controller.js";
import {
  createCustomSectionSchema,
  updateCustomSectionSchema,
  getCustomSectionSchema,
  paramsCustomSectionIdSchema,
  paramsQuotationFormatIdSchema,
} from "./quotation-format-custom-section.validation.js";

import authMiddleware from "../../../middleware/authMiddleware.js";
import roleMiddleware from "../../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../../middleware/caseConverterMiddleware.js";
import { REQUEST_SOURCE } from "../../../config/constants.js";
import { validateRequest } from "../../../middleware/validateRequestMiddleware.js";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

// ============================================================
//        CUSTOM SECTION ROUTES
// ============================================================

router.post(
  "/:quotation_format_id",
  validateRequest(paramsQuotationFormatIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(createCustomSectionSchema, REQUEST_SOURCE.BODY),
  createQuotationFormatCustomSection
);

router.get(
  "/",
  validateRequest(getCustomSectionSchema, REQUEST_SOURCE.QUERY),
  getQuotationFormatCustomSections
);

router.get(
  "/:custom_section_id",
  validateRequest(paramsCustomSectionIdSchema, REQUEST_SOURCE.PARAMS),
  getQuotationFormatCustomSectionById
);

router.put(
  "/:custom_section_id",
  validateRequest(paramsCustomSectionIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateCustomSectionSchema, REQUEST_SOURCE.BODY),
  updateQuotationFormatCustomSection
);

router.delete(
  "/:custom_section_id",
  validateRequest(paramsCustomSectionIdSchema, REQUEST_SOURCE.PARAMS),
  deleteQuotationFormatCustomSection
);

export default router;
