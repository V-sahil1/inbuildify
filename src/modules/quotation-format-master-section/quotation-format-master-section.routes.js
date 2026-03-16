import express from "express";

const router = express.Router();

import quotationFormatMasterSectionController from "./quotation-format-master-section.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware";
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
} from "./quotation-format-master-section.validation";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import { REQUEST_SOURCE } from "../../config/constants";

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

// ============================================================
//        MASTER SECTION ROUTES
// ============================================================

router.post(
  "/master-section",
  validateRequest(createMasterSectionSchema, REQUEST_SOURCE.BODY),
  quotationFormatMasterSectionController.createMasterSection,
);

router.get(
  "/master-section",
  validateRequest(getMasterSectionSchema, REQUEST_SOURCE.QUERY),
  quotationFormatMasterSectionController.getMasterSections,
);

router.get(
  "/master-section/:master_section_id",
  validateRequest(paramsMasterSectionIdSchema, REQUEST_SOURCE.PARAMS),
  quotationFormatMasterSectionController.getMasterSectionById,
);

router.put(
  "/master-section/:master_section_id",
  validateRequest(paramsMasterSectionIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateMasterSectionSchema, REQUEST_SOURCE.BODY),
  quotationFormatMasterSectionController.updateMasterSection,
);

router.delete(
  "/master-section/:master_section_id",
  validateRequest(paramsMasterSectionIdSchema, REQUEST_SOURCE.PARAMS),
  quotationFormatMasterSectionController.deleteMasterSection,
);

// ============================================================
//        MASTER SECTION HEADER ROUTES
// ============================================================

router.post(
  "/master-section-header",
  validateRequest(createMasterSectionHeaderSchema, REQUEST_SOURCE.BODY),
  quotationFormatMasterSectionController.createMasterSectionHeader,
);

router.get(
  "/master-section-header",
  validateRequest(getMasterSectionHeaderSchema, REQUEST_SOURCE.QUERY),
  quotationFormatMasterSectionController.getMasterSectionHeaders,
);

router.get(
  "/master-section-header/:header_id",
  validateRequest(paramsHeaderIdSchema, REQUEST_SOURCE.PARAMS),
  quotationFormatMasterSectionController.getMasterSectionHeaderById,
);

router.put(
  "/master-section-header/:header_id",
  validateRequest(paramsHeaderIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateMasterSectionHeaderSchema, REQUEST_SOURCE.BODY),
  quotationFormatMasterSectionController.updateMasterSectionHeader,
);

router.delete(
  "/master-section-header/:header_id",
  validateRequest(paramsHeaderIdSchema, REQUEST_SOURCE.PARAMS),
  quotationFormatMasterSectionController.deleteMasterSectionHeader,
);

// ============================================================
//        MASTER SECTION ITEM ROUTES
// ============================================================

router.post(
  "/master-section-item",
  validateRequest(createMasterSectionItemSchema, REQUEST_SOURCE.BODY),
  quotationFormatMasterSectionController.createMasterSectionItem,
);

router.get(
  "/master-section-item",
  validateRequest(getMasterSectionItemSchema, REQUEST_SOURCE.QUERY),
  quotationFormatMasterSectionController.getMasterSectionItems,
);

router.get(
  "/master-section-item/:item_id",
  validateRequest(paramsItemIdSchema, REQUEST_SOURCE.PARAMS),
  quotationFormatMasterSectionController.getMasterSectionItemById,
);

router.put(
  "/master-section-item/:item_id",
  validateRequest(paramsItemIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateMasterSectionItemSchema, REQUEST_SOURCE.BODY),
  quotationFormatMasterSectionController.updateMasterSectionItem,
);

router.delete(
  "/master-section-item/:item_id",
  validateRequest(paramsItemIdSchema, REQUEST_SOURCE.PARAMS),
  quotationFormatMasterSectionController.deleteMasterSectionItem,
);

export default router;
