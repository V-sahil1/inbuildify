import express from "express";
import authMiddleware from "../../../../middleware/authMiddleware.js";
import roleMiddleware from "../../../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../../../middleware/validateRequestMiddleware.js";
import { REQUEST_SOURCE } from "../../../../config/constants.js";
import { paramsMasterSectionHeaderIdSchema } from "../quotation-format-master-section.validation.js";
import {
  createMasterSectionItem,
  getMasterSectionItems,
  getMasterSectionItemById,
  updateMasterSectionItem,
  deleteMasterSectionItem,
} from "./quotation-format-master-section-item.controller.js";
import {
  createMasterSectionItemSchema,
  updateMasterSectionItemSchema,
  getMasterSectionItemSchema,
  paramsItemIdSchema,
} from "./quotation-format-master-section-item.validation.js";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/:master_section_header_id",
  validateRequest(paramsMasterSectionHeaderIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(createMasterSectionItemSchema, REQUEST_SOURCE.BODY),
  createMasterSectionItem,
);

router.get(
  "/:item_id",
  validateRequest(paramsItemIdSchema, REQUEST_SOURCE.PARAMS),
  getMasterSectionItemById,
);

router.get(
  "/",
  validateRequest(getMasterSectionItemSchema, REQUEST_SOURCE.QUERY),
  getMasterSectionItems,
);

router.put(
  "/:item_id",
  validateRequest(paramsItemIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateMasterSectionItemSchema, REQUEST_SOURCE.BODY),
  updateMasterSectionItem,
);

router.delete(
  "/:item_id",
  validateRequest(paramsItemIdSchema, REQUEST_SOURCE.PARAMS),
  deleteMasterSectionItem,
);

export default router;
