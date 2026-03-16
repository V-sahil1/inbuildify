import express from "express";

const router = express.Router();

import {
  getAllColorSubCategories,
  getColorSubCategoryById,
  createColorSubCategory,
  updateColorSubCategory,
  deleteColorSubCategory,
} from "./color-sub-category.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import {
  getAllColorSubCategoriesSchema,
  getAllColorSubCategoriesParamsSchema,
  createColorSubCategorySchema,
  updateColorSubCategorySchema,
  colorSubCategoryIdParamSchema,
} from "./color-sub-category.validation";
import { REQUEST_SOURCE } from "../../config/constants";

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/:color_category_id", validateRequest(getAllColorSubCategoriesParamsSchema, REQUEST_SOURCE.PARAMS), validateRequest(getAllColorSubCategoriesSchema, REQUEST_SOURCE.QUERY), getAllColorSubCategories);
router.get("/sub_category/:color_sub_category_id", validateRequest(colorSubCategoryIdParamSchema, REQUEST_SOURCE.PARAMS), getColorSubCategoryById);
router.post("/", validateRequest(createColorSubCategorySchema, REQUEST_SOURCE.BODY), createColorSubCategory);
router.put("/:color_sub_category_id", validateRequest(updateColorSubCategorySchema, REQUEST_SOURCE.BODY), updateColorSubCategory);
router.delete("/:color_sub_category_id", validateRequest(colorSubCategoryIdParamSchema, REQUEST_SOURCE.PARAMS), deleteColorSubCategory);

export default router;
