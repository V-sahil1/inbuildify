const express = require("express");
const router = express.Router();
const {
  createMasterPriceListCategoryItem,
  updateMasterPriceListCategoryItem,
  getMasterPriceListCategoryItemsByCategoryId,
  deleteMasterPriceListCategoryItem,
} = require("../controllers/master-price-list-category-item.controller");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  createMasterPriceListCategoryItemSchema,
  getMasterPriceListCategoryItemsByCategoryIdSchema,
  updateMasterPriceListCategoryItemSchema,
  deleteMasterPriceListCategoryItemSchema,
} = require("../validations/master-price-list-category-item.validation");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

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
