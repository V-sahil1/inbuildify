const express = require("express");
const router = express.Router();
const {
  getAllColorSubCategories,
  getColorSubCategoryById,
  createColorSubCategory,
  updateColorSubCategory,
  deleteColorSubCategory,
} = require("../controllers/color-sub-category.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  getAllColorSubCategoriesSchema,
  createColorSubCategorySchema,
  updateColorSubCategorySchema,
  colorSubCategoryIdParamSchema,
} = require("../validations/color-sub-category.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", validateRequest(getAllColorSubCategoriesSchema, REQUEST_SOURCE.QUERY), getAllColorSubCategories);
router.get("/:color_sub_category_id", validateRequest(colorSubCategoryIdParamSchema, REQUEST_SOURCE.PARAMS), getColorSubCategoryById);
router.post("/", validateRequest(createColorSubCategorySchema, REQUEST_SOURCE.BODY), createColorSubCategory);
router.put("/:color_sub_category_id", validateRequest(updateColorSubCategorySchema, REQUEST_SOURCE.BODY), updateColorSubCategory);
router.delete("/:color_sub_category_id", validateRequest(colorSubCategoryIdParamSchema, REQUEST_SOURCE.PARAMS), deleteColorSubCategory);

module.exports = router;
