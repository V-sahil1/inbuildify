import express from "express";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";
import quotationVersionItemController from "./quotation-version-item.controller.js";
import {
  addQuotationItemSchema,
  addQuotationPackageSchema,
  updateQuotationItemSchema,
  getItemsByVersionParamsSchema,
  getItemsByVersionQuerySchema,
  idParamsSchema,
  deletePackageParamsSchema,
} from "./quotation-version-item.validation.js";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware);

// Add single item snapshot
router.post(
  "/item",
  camelToSnakeMiddleware,
  validateRequest(addQuotationItemSchema, REQUEST_SOURCE.BODY),
  quotationVersionItemController.addQuotationItem,
);

// Add package items snapshot
router.post(
  "/package",
  camelToSnakeMiddleware,
  validateRequest(addQuotationPackageSchema, REQUEST_SOURCE.BODY),
  quotationVersionItemController.addQuotationPackage,
);

// List all items for a version
router.get(
  "/version/:quotation_version_id",
  validateRequest(getItemsByVersionParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(getItemsByVersionQuerySchema, REQUEST_SOURCE.QUERY),
  quotationVersionItemController.getQuotationVersionItems,
);

// Update item snapshot
router.put(
  "/:id",
  camelToSnakeMiddleware,
  validateRequest(idParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateQuotationItemSchema, REQUEST_SOURCE.BODY),
  quotationVersionItemController.updateQuotationVersionItem,
);

// Delete item
router.delete(
  "/item/:id",
  validateRequest(idParamsSchema, REQUEST_SOURCE.PARAMS),
  quotationVersionItemController.deleteQuotationVersionItem,
);

// Delete package items from version
router.delete(
  "/package/:quotation_version_id/:package_id",
  validateRequest(deletePackageParamsSchema, REQUEST_SOURCE.PARAMS),
  quotationVersionItemController.deletePackageFromVersion,
);

export default router;
