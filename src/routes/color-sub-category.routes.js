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
  getAllColorSubCategoriesParamsSchema,
  createColorSubCategorySchema,
  updateColorSubCategorySchema,
  colorSubCategoryIdParamSchema,
} = require("../validations/color-sub-category.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/:color_category_id", validateRequest(getAllColorSubCategoriesParamsSchema, REQUEST_SOURCE.PARAMS), validateRequest(getAllColorSubCategoriesSchema, REQUEST_SOURCE.QUERY), getAllColorSubCategories);
router.get("/sub_category/:color_sub_category_id", validateRequest(colorSubCategoryIdParamSchema, REQUEST_SOURCE.PARAMS), getColorSubCategoryById);
router.post("/", validateRequest(createColorSubCategorySchema, REQUEST_SOURCE.BODY), createColorSubCategory);
router.put("/:color_sub_category_id", validateRequest(updateColorSubCategorySchema, REQUEST_SOURCE.BODY), updateColorSubCategory);
router.delete("/:color_sub_category_id", validateRequest(colorSubCategoryIdParamSchema, REQUEST_SOURCE.PARAMS), deleteColorSubCategory);

module.exports = router;
