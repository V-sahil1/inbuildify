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

// Create price list item mapping
router.post(
  "/",
  validateRequest(createPriceListItemMapSchema, REQUEST_SOURCE.BODY),
  createPriceListItemMap
);

// Get all price list item mappings for the organization
router.get(
  "/",
  getAllPriceListItemMaps
);

// Get all price list item mappings for a package
router.get(
  "/:house_land_package_id",
  validateRequest(getPriceListItemMapsSchema, REQUEST_SOURCE.PARAMS),
  getPriceListItemMaps
);

// Update price list item mapping
router.put(
  "/:id",
  validateRequest(updatePriceListItemMapSchema, REQUEST_SOURCE.BODY),
  validateRequest(deletePriceListItemMapSchema, REQUEST_SOURCE.PARAMS),
  updatePriceListItemMap
);

// Delete price list item mapping
router.delete(
  "/:id",
  validateRequest(deletePriceListItemMapSchema, REQUEST_SOURCE.PARAMS),
  deletePriceListItemMap
);

// --- Package Commission Map Routes ---

// Create package commission mapping
router.post(
  "/package-commission",
  validateRequest(createPackageCommissionMapSchema, REQUEST_SOURCE.BODY),
  createPackageCommissionMap
);

// Get all package commission mappings for the organization
router.get(
  "/package-commission/all/data",
  getAllPackageCommissionMaps
);

// Get mappings for a specific package
router.get(
  "/package-commission/:house_land_package_id",
  validateRequest(getPriceListItemMapsSchema, REQUEST_SOURCE.PARAMS),
  getPackageCommissionMaps
);

// Update package commission mapping
router.put(
  "/package-commission/:id",
  validateRequest(deletePriceListItemMapSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updatePackageCommissionMapSchema, REQUEST_SOURCE.BODY),
  updatePackageCommissionMap
);

// Delete package commission mapping
router.delete(
  "/package-commission/:id",
  validateRequest(deletePriceListItemMapSchema, REQUEST_SOURCE.PARAMS),
  deletePackageCommissionMap
);

module.exports = router;