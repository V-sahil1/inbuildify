const express = require("express");
const router = express.Router();
const {
  getAllMasterPriceListCategories,
  getMasterPriceListCategoryById,
  createMasterPriceListCategory,
  updateMasterPriceListCategory,
  displayOrderManage,
  deleteMasterPriceListCategory,
} = require("./master-price-list-category.controller.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const {
  getAllMasterPriceListCategoriesSchema,
  createMasterPriceListCategorySchema,
  updateMasterPriceListCategorySchema,
  displayOrderManageSchema,
  deleteMasterPriceListCategorySchema,
  getMasterPriceListCategoryByIdSchema,
} = require("./master-price-list-category.validation.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.get(
  "/",
  validateRequest(getAllMasterPriceListCategoriesSchema, REQUEST_SOURCE.QUERY),
  getAllMasterPriceListCategories
);
router.get(
  "/:id",
  validateRequest(getMasterPriceListCategoryByIdSchema, REQUEST_SOURCE.PARAMS),
  getMasterPriceListCategoryById
);
router.post(
  "/",
  validateRequest(createMasterPriceListCategorySchema, REQUEST_SOURCE.BODY),
  createMasterPriceListCategory
);
router.put(
  "/:id",
  validateRequest(updateMasterPriceListCategorySchema, REQUEST_SOURCE.BODY),
  updateMasterPriceListCategory
);
router.put(
  "/order/display-order",
  validateRequest(displayOrderManageSchema, REQUEST_SOURCE.BODY),
  displayOrderManage
);
router.delete(
  "/:id",
  validateRequest(deleteMasterPriceListCategorySchema, REQUEST_SOURCE.PARAMS),
  deleteMasterPriceListCategory
);

module.exports = router;
