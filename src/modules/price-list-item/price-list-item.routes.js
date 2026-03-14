const express = require("express");
const router = express.Router();

const {
  createPriceListItem,
  getAllPriceListItems,
  deletePriceListItem,
  updatePriceListItem,
} = require("./price-list-item.controller.js");
const {
  createPriceListItemSchema,
  getAllPriceListItemSchema,
  deletePriceListItemSchema,
  updatePriceListItemSParamschema,
  updatePriceListItemSchema,
} = require("./price-list-item.validation.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../../config/constants.js");

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
