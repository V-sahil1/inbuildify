const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");
const {
  createPricelistItemMapSchema,
  getByVersionParamsSchema,
  updatePricelistItemMapSchema,
  idParamsSchema,
} = require("../validations/quotation-version-pricelist-item-map.validation");
const controller = require("../controllers/quotation-version-pricelist-item-map.controller");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  camelToSnakeMiddleware,
  validateRequest(createPricelistItemMapSchema, REQUEST_SOURCE.BODY),
  controller.createPricelistItemMap
);

router.get(
  "/:quotation_version_id",
  validateRequest(getByVersionParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.getPricelistItemsByVersionId
);

router.put(
  "/:id",
  camelToSnakeMiddleware,
  validateRequest(idParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updatePricelistItemMapSchema, REQUEST_SOURCE.BODY),
  controller.updatePricelistItemMap
);

router.delete(
  "/:id",
  validateRequest(idParamsSchema, REQUEST_SOURCE.PARAMS),
  controller.deletePricelistItemMap
);

module.exports = router;
