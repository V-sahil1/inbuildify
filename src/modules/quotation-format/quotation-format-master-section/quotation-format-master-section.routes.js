import express from "express";

const router = express.Router();

import {
  createMasterSection,
  getMasterSections,
  updateMasterSection,
  deleteMasterSection,
  copyMasterSection,
} from "./quotation-format-master-section.controller.js";
import authMiddleware from "../../../middleware/authMiddleware.js";
import roleMiddleware from "../../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../../middleware/caseConverterMiddleware.js";
import {
  createMasterSectionSchema,
  updateMasterSectionSchema,
  getMasterSectionSchema,
  paramsMasterSectionIdSchema,
  paramsQuotationFormatIdSchema,
} from "./quotation-format-master-section.validation.js";
import { validateRequest } from "../../../middleware/validateRequestMiddleware.js";
import { REQUEST_SOURCE } from "../../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

// ============================================================
//        MASTER SECTION ROUTES
// ============================================================

router.post(
  "/:quotation_format_id",
  validateRequest(paramsQuotationFormatIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(createMasterSectionSchema, REQUEST_SOURCE.BODY),
  createMasterSection,
);

router.get(
  "/:quotation_format_id",
  validateRequest(paramsQuotationFormatIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(getMasterSectionSchema, REQUEST_SOURCE.QUERY),
  getMasterSections,
);

router.put(
  "/:master_section_id",
  validateRequest(paramsMasterSectionIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateMasterSectionSchema, REQUEST_SOURCE.BODY),
  updateMasterSection,
);

router.delete(
  "/:master_section_id",
  validateRequest(paramsMasterSectionIdSchema, REQUEST_SOURCE.PARAMS),
  deleteMasterSection,
);

router.post(
  "/:master_section_id/copy",
  validateRequest(paramsMasterSectionIdSchema, REQUEST_SOURCE.PARAMS),
  copyMasterSection,
);

// ============================================================
export default router;
