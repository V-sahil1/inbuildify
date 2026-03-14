const express = require("express");
const router = express.Router();
const {
  createPriceListItemMap,
  getPriceListItemMaps,
  getAllPriceListItemMaps,
  updatePriceListItemMap,
  deletePriceListItemMap,
  createPackageCommissionMap,
  getPackageCommissionMaps,
  getAllPackageCommissionMaps,
  updatePackageCommissionMap,
  deletePackageCommissionMap,
} = require("./h-l-package-pricelist-item-commission.controller.js");

const {
  createPriceListItemMapSchema,
  updatePriceListItemMapSchema,
  getPriceListItemMapsSchema,
  deletePriceListItemMapSchema,
  createPackageCommissionMapSchema,
  updatePackageCommissionMapSchema,
} = require("./h-l-package-pricelist-item-commission.validation.js");

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
  createPriceListItemMap
);

router.get(
  "/",
  getAllPriceListItemMaps
);

router.get(
  "/:house_land_package_id",
  validateRequest(getPriceListItemMapsSchema, REQUEST_SOURCE.PARAMS),
  getPriceListItemMaps
);

router.put(
  "/:id",
  validateRequest(updatePriceListItemMapSchema, REQUEST_SOURCE.BODY),
  validateRequest(deletePriceListItemMapSchema, REQUEST_SOURCE.PARAMS),
  updatePriceListItemMap
);

router.delete(
  "/:id",
  validateRequest(deletePriceListItemMapSchema, REQUEST_SOURCE.PARAMS),
  deletePriceListItemMap
);

// --- Package Commission Map Routes ---

router.post(
  "/package-commission",
  validateRequest(createPackageCommissionMapSchema, REQUEST_SOURCE.BODY),
  createPackageCommissionMap
);

router.get(
  "/package-commission/all",
  getAllPackageCommissionMaps
);

router.get(
  "/package-commission/:house_land_package_id",
  validateRequest(getPriceListItemMapsSchema, REQUEST_SOURCE.PARAMS),
  getPackageCommissionMaps
);

router.put(
  "/package-commission/:id",
  validateRequest(deletePriceListItemMapSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updatePackageCommissionMapSchema, REQUEST_SOURCE.BODY),
  updatePackageCommissionMap
);

router.delete(
  "/package-commission/:id",
  validateRequest(deletePriceListItemMapSchema, REQUEST_SOURCE.PARAMS),
  deletePackageCommissionMap
);

module.exports = router;