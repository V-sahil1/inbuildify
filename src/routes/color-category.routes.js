const express = require("express");
const router = express.Router();

const {
  createColorCategory,
  getColorCategories,
  getColorCategoryById,
  getColorCategoriesByColorId,
  updateColorCategory,
  deleteColorCategory,
} = require("../controllers/color-category.controller");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");
const {
  createColorCategorySchema,
  updateColorCategorySchema,
  paramsIdSchema,
} = require("../validations/color-category.validation");

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

module.exports = router;
