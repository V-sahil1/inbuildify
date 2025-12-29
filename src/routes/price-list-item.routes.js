const express = require("express");
const router = express.Router();

const {
  createPriceListItem,
  getAllPriceListItems,
  deletePriceListItem,
  updatePriceListItem,
} = require("../controllers/price-list-item.controller");
const {
  createPriceListItemSchema,
  getAllPriceListItemSchema,
  deletePriceListItemSchema,
  updatePriceListItemSParamschema,
  updatePriceListItemSchema,
} = require("../validations/price-list-item.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

router.post(
  "/",
  validateRequest(createPriceListItemSchema, REQUEST_SOURCE.BODY),
  createPriceListItem
);

router.get(
  "/",
  validateRequest(getAllPriceListItemSchema, REQUEST_SOURCE.QUERY),
  getAllPriceListItems
);

router.delete(
  "/:priceListItemId",
  validateRequest(deletePriceListItemSchema, REQUEST_SOURCE.PARAMS),
  deletePriceListItem
);

router.put(
  "/:price_list_item_id",
  validateRequest(updatePriceListItemSParamschema, REQUEST_SOURCE.PARAMS),
  validateRequest(updatePriceListItemSchema, REQUEST_SOURCE.BODY),
  updatePriceListItem
);

module.exports = router;
