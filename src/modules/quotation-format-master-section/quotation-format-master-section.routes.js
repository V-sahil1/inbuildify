import express from "express";

const router = express.Router();

import {
  createMasterSection,
  getMasterSections,
  getMasterSectionById,
  updateMasterSection,
  deleteMasterSection,
  createMasterSectionHeader,
  getMasterSectionHeaders,
  getMasterSectionHeaderById,
  updateMasterSectionHeader,
  deleteMasterSectionHeader,
  createMasterSectionItem,
  getMasterSectionItems,
  getMasterSectionItemById,
  updateMasterSectionItem,
  deleteMasterSectionItem,
} from "./quotation-format-master-section.controller.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import {
  createMasterSectionSchema,
  updateMasterSectionSchema,
  getMasterSectionSchema,
  paramsMasterSectionIdSchema,
  createMasterSectionHeaderSchema,
  updateMasterSectionHeaderSchema,
  getMasterSectionHeaderSchema,
  paramsHeaderIdSchema,
  createMasterSectionItemSchema,
  updateMasterSectionItemSchema,
  getMasterSectionItemSchema,
  paramsItemIdSchema,
} from "./quotation-format-master-section.validation.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

// ============================================================
//        MASTER SECTION ROUTES
// ============================================================

router.post(
  "/master-section",
  validateRequest(createMasterSectionSchema, REQUEST_SOURCE.BODY),
  createMasterSection,
);

router.get(
  "/master-section",
  validateRequest(getMasterSectionSchema, REQUEST_SOURCE.QUERY),
  getMasterSections,
);

router.get(
  "/master-section/:master_section_id",
  validateRequest(paramsMasterSectionIdSchema, REQUEST_SOURCE.PARAMS),
  getMasterSectionById,
);

router.put(
  "/master-section/:master_section_id",
  validateRequest(paramsMasterSectionIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateMasterSectionSchema, REQUEST_SOURCE.BODY),
  updateMasterSection,
);

router.delete(
  "/master-section/:master_section_id",
  validateRequest(paramsMasterSectionIdSchema, REQUEST_SOURCE.PARAMS),
  deleteMasterSection,
);

// ============================================================
//        MASTER SECTION HEADER ROUTES
// ============================================================

router.post(
  "/master-section-header",
  validateRequest(createMasterSectionHeaderSchema, REQUEST_SOURCE.BODY),
  createMasterSectionHeader,
);

router.get(
  "/master-section-header",
  validateRequest(getMasterSectionHeaderSchema, REQUEST_SOURCE.QUERY),
  getMasterSectionHeaders,
);

router.get(
  "/master-section-header/:header_id",
  validateRequest(paramsHeaderIdSchema, REQUEST_SOURCE.PARAMS),
  getMasterSectionHeaderById,
);

router.put(
  "/master-section-header/:header_id",
  validateRequest(paramsHeaderIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateMasterSectionHeaderSchema, REQUEST_SOURCE.BODY),
  updateMasterSectionHeader,
);

router.delete(
  "/master-section-header/:header_id",
  validateRequest(paramsHeaderIdSchema, REQUEST_SOURCE.PARAMS),
  deleteMasterSectionHeader,
);

// ============================================================
//        MASTER SECTION ITEM ROUTES
// ============================================================

router.post(
  "/master-section-item",
  validateRequest(createMasterSectionItemSchema, REQUEST_SOURCE.BODY),
  createMasterSectionItem,
);

router.get(
  "/master-section-item",
  validateRequest(getMasterSectionItemSchema, REQUEST_SOURCE.QUERY),
  getMasterSectionItems,
);

router.get(
  "/master-section-item/:item_id",
  validateRequest(paramsItemIdSchema, REQUEST_SOURCE.PARAMS),
  getMasterSectionItemById,
);

router.put(
  "/master-section-item/:item_id",
  validateRequest(paramsItemIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateMasterSectionItemSchema, REQUEST_SOURCE.BODY),
  updateMasterSectionItem,
);

router.delete(
  "/master-section-item/:item_id",
  validateRequest(paramsItemIdSchema, REQUEST_SOURCE.PARAMS),
  deleteMasterSectionItem,
);

export default router;
