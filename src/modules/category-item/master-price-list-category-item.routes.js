const express = require("express");
const router = express.Router();
const {
  createMasterPriceListCategoryItem,
  updateMasterPriceListCategoryItem,
  getMasterPriceListCategoryItemsByCategoryId,
  deleteMasterPriceListCategoryItem,
} = require("./master-price-list-category-item.controller.js");
const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const {
  createMasterPriceListCategoryItemSchema,
  getMasterPriceListCategoryItemsByCategoryIdSchema,
  updateMasterPriceListCategoryItemSchema,
  deleteMasterPriceListCategoryItemSchema,
} = require("./master-price-list-category-item.validation.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createMasterPriceListCategoryItemSchema),
  createMasterPriceListCategoryItem
);
router.get(
  "/:categoryId",
  validateRequest(
    getMasterPriceListCategoryItemsByCategoryIdSchema,
    REQUEST_SOURCE.QUERY
  ),
  getMasterPriceListCategoryItemsByCategoryId
);
router.put(
  "/:category_item_id",
  validateRequest(updateMasterPriceListCategoryItemSchema),
  updateMasterPriceListCategoryItem
);
router.delete(
  "/:category_item_id",
  validateRequest(
    deleteMasterPriceListCategoryItemSchema,
    REQUEST_SOURCE.PARAMS
  ),
  deleteMasterPriceListCategoryItem
);

module.exports = router;
