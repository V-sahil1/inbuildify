import express from "express";

const router = express.Router();

import {
  createColorCategory,
  getColorCategories,
  getColorCategoryById,
  getColorCategoriesByColorId,
  updateColorCategory,
  deleteColorCategory,
  copyColorCategory,
} from "./color-category.controller.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { REQUEST_SOURCE } from "../../config/constants.js";
import {
  createColorCategorySchema,
  updateColorCategorySchema,
  paramsIdSchema,
  copyColorCategorySchema,
} from "./color-category.validation.js";

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  camelToSnakeMiddleware,
  validateRequest(createColorCategorySchema, REQUEST_SOURCE.BODY),
  createColorCategory,
);

router.get("/", getColorCategories);

router.get("/:id", getColorCategoriesByColorId);

router.put(
  "/:id",
  camelToSnakeMiddleware,
  validateRequest(paramsIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateColorCategorySchema, REQUEST_SOURCE.BODY),
  updateColorCategory,
);

router.delete(
  "/:id",
  validateRequest(paramsIdSchema, REQUEST_SOURCE.PARAMS),
  deleteColorCategory,
);

// POST /api/color-category/:id/copy - Copy a color category to a specific color
router.post(
  "/copy/:id",
  validateRequest(paramsIdSchema, REQUEST_SOURCE.PARAMS),
  camelToSnakeMiddleware,
  validateRequest(copyColorCategorySchema, REQUEST_SOURCE.BODY),
  copyColorCategory,
);

export default router;
