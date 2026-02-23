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
} = require("../controllers/h-l-package-pricelist-item-commission.controller");

const {
  createPriceListItemMapSchema,
  updatePriceListItemMapSchema,
  getPriceListItemMapsSchema,
  deletePriceListItemMapSchema,
  createPackageCommissionMapSchema,
  updatePackageCommissionMapSchema,
} = require("../validations/h-l-package-pricelist-item-commission.validation");

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