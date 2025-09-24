const express = require("express");
const router = express.Router();
const {
  getAllColorCategories,
  getColorCategoryById,
  createColorCategory,
  updateColorCategory,
  deleteColorCategory,
} = require("../controllers/color-category.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  getAllColorCategoriesSchema,
  createColorCategorySchema,
  updateColorCategorySchema,
  colorCategoryIdParamSchema,
} = require("../validations/color-category.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", validateRequest(getAllColorCategoriesSchema, REQUEST_SOURCE.QUERY), getAllColorCategories);
router.get("/:color_category_id", validateRequest(colorCategoryIdParamSchema, REQUEST_SOURCE.PARAMS), getColorCategoryById);
router.post("/", validateRequest(createColorCategorySchema, REQUEST_SOURCE.BODY), createColorCategory);
router.put("/:color_category_id", validateRequest(updateColorCategorySchema, REQUEST_SOURCE.BODY), updateColorCategory);
router.delete("/:color_category_id", validateRequest(colorCategoryIdParamSchema, REQUEST_SOURCE.PARAMS), deleteColorCategory);

module.exports = router;
