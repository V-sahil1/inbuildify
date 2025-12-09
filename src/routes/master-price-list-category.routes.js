const express = require("express");
const router = express.Router();
const {
  getAllMasterPriceListCategories,
  getMasterPriceListCategoryById,
  createMasterPriceListCategory,
  updateMasterPriceListCategory,
  displayOrderManage,
  deleteMasterPriceListCategory,
} = require("../controllers/master-price-list-category.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  getAllMasterPriceListCategoriesSchema,
  createMasterPriceListCategorySchema,
  updateMasterPriceListCategorySchema,
  displayOrderManageSchema,
  deleteMasterPriceListCategorySchema,
  getMasterPriceListCategoryByIdSchema,
} = require("../validations/master-price-list-category.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

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
