const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");
const {
  createPricelistItemMapSchema,
  getByVersionParamsSchema,
  updatePricelistItemMapSchema,
  idParamsSchema,
} = require("./quotation-version-pricelist-item-map.validation.js");
const controller = require("./quotation-version-pricelist-item-map.controller.js");

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
