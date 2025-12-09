const express = require("express");
const router = express.Router();

const {
  createPackagePriceListItemMap,
  getAllPackagePriceListItemMap,
  getPackagePricelistItemByPackageId,
  deletePackagePricelistItemMapMap,
  updatePackagePriceListItemMap,
} = require("../controllers/package_pricelist_item_map.controller");
const {
  createPriceListItemMapSchema,
  getAllPackagePriceListItemMapSchema,
  getPackagePricelistItemByPackageIdSchema,
  deletePackagePricelistItemMapMapSchema,
  updateackagePricelistItemMapParamsSchema,
  updatePriceListItemMapSchema,
} = require("../validations/package-pricelist-item-map.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

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
