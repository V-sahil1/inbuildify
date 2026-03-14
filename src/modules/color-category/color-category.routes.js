const express = require("express");
const router = express.Router();

const {
  createColorCategory,
  getColorCategories,
  getColorCategoryById,
  getColorCategoriesByColorId,
  updateColorCategory,
  deleteColorCategory,
  copyColorCategory,
} = require("./color-category.controller");

const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware");
const { validateRequest } = require("../../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../../config/constants");
const {
  createColorCategorySchema,
  updateColorCategorySchema,
  paramsIdSchema,
  copyColorCategorySchema,
} = require("./color-category.validation");

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

module.exports = router;
