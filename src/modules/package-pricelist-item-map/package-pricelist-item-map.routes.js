const express = require("express");
const router = express.Router();

const {
  createPackagePriceListItemMap,
  getAllPackagePriceListItemMap,
  getPackagePricelistItemByPackageId,
  deletePackagePricelistItemMapMap,
  updatePackagePriceListItemMap,
} = require("./package_pricelist_item_map.controller.js");
const {
  createPriceListItemMapSchema,
  getAllPackagePriceListItemMapSchema,
  getPackagePricelistItemByPackageIdSchema,
  deletePackagePricelistItemMapMapSchema,
  updateackagePricelistItemMapParamsSchema,
  updatePriceListItemMapSchema,
} = require("./package-pricelist-item-map.validation.js");

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
  validateRequest(createPriceListItemMapSchema, REQUEST_SOURCE.BODY),
  createPackagePriceListItemMap
);

router.get(
  "/",
  validateRequest(getAllPackagePriceListItemMapSchema, REQUEST_SOURCE.QUERY),
  getAllPackagePriceListItemMap
);

router.get(
  "/:package_id",
  validateRequest(
    getPackagePricelistItemByPackageIdSchema,
    REQUEST_SOURCE.PARAMS
  ),
  getPackagePricelistItemByPackageId
);

router.delete(
  "/:id",
  validateRequest(
    deletePackagePricelistItemMapMapSchema,
    REQUEST_SOURCE.PARAMS
  ),
  deletePackagePricelistItemMapMap
);

router.put(
  "/:id",
  validateRequest(
    updateackagePricelistItemMapParamsSchema,
    REQUEST_SOURCE.PARAMS
  ),
  validateRequest(updatePriceListItemMapSchema, REQUEST_SOURCE.BODY),
  updatePackagePriceListItemMap
);

module.exports = router;
