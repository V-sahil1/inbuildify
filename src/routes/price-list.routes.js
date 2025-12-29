const express = require("express");
const router = express.Router();

const {
  createPriceList,
  getAllPriceList,
  deletePriceList,
  updatePriceList,
} = require("../controllers/price-list.controller");
const {
  createPriceListSchema,
  getAllPriceListSchema,
  deletePriceListSchema,
  updatePriceListParamsSchema,
  updatePriceListSchema,
} = require("../validations/price-list.validation");

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
  validateRequest(createPriceListSchema, REQUEST_SOURCE.BODY),
  createPriceList
);

router.get(
  "/",
  validateRequest(getAllPriceListSchema, REQUEST_SOURCE.QUERY),
  getAllPriceList
);

router.delete(
  "/:priceListId",
  validateRequest(deletePriceListSchema, REQUEST_SOURCE.PARAMS),
  deletePriceList
);

router.put(
  "/:priceListId",
  validateRequest(updatePriceListParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updatePriceListSchema, REQUEST_SOURCE.BODY),
  updatePriceList
);
module.exports = router;
