const express = require("express");
const router = express.Router();
const {
  createPriceListItemCondition,
  getAllPriceListItemConditions,
  getPriceListItemConditionById,
  updatePriceListItemCondition,
  deletePriceListItemCondition,
} = require("../controllers/price-list-item-condition.controller");
const {
  createPriceListItemConditionValidation,
  updatePriceListItemConditionValidation,
  getPriceListItemConditionByIdValidation,
  deletePriceListItemConditionValidation,
  getAllPriceListItemConditionsValidation,
} = require("../validations/price-list-item-condition.validation");

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
  validateRequest(createPriceListItemConditionValidation, REQUEST_SOURCE.BODY),
  createPriceListItemCondition,
);

router.get(
  "/",
  validateRequest(
    getAllPriceListItemConditionsValidation,
    REQUEST_SOURCE.QUERY,
  ),
  getAllPriceListItemConditions,
);

router.get(
  "/:price_list_item_condition_id",
  validateRequest(
    getPriceListItemConditionByIdValidation,
    REQUEST_SOURCE.PARAMS,
  ),
  getPriceListItemConditionById,
);

router.put(
  "/:price_list_item_condition_id",
  validateRequest(
    getPriceListItemConditionByIdValidation,
    REQUEST_SOURCE.PARAMS,
  ),
  validateRequest(updatePriceListItemConditionValidation, REQUEST_SOURCE.BODY),
  updatePriceListItemCondition,
);

router.delete(
  "/:price_list_item_condition_id",
  validateRequest(
    deletePriceListItemConditionValidation,
    REQUEST_SOURCE.PARAMS,
  ),
  deletePriceListItemCondition,
);

module.exports = router;
