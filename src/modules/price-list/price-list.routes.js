const express = require("express");
const router = express.Router();

const {
  createPriceList,
  getAllPriceList,
  deletePriceList,
  updatePriceList,
  toggleSuggestedPriceList,
} = require("./price-list.controller.js");
const {
  createPriceListSchema,
  getAllPriceListSchema,
  deletePriceListSchema,
  updatePriceListParamsSchema,
  updatePriceListSchema,
} = require("./price-list.validation.js");

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
  validateRequest(createPriceListSchema, REQUEST_SOURCE.BODY),
  createPriceList,
);

router.get(
  "/",
  validateRequest(getAllPriceListSchema, REQUEST_SOURCE.QUERY),
  getAllPriceList,
);

router.delete(
  "/:priceListId",
  validateRequest(deletePriceListSchema, REQUEST_SOURCE.PARAMS),
  deletePriceList,
);

router.put(
  "/:priceListId",
  validateRequest(updatePriceListParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updatePriceListSchema, REQUEST_SOURCE.BODY),
  updatePriceList,
);

router.put(
  "/suggested/:priceListId",
  validateRequest(deletePriceListSchema, REQUEST_SOURCE.PARAMS),
  toggleSuggestedPriceList,
);

module.exports = router;
