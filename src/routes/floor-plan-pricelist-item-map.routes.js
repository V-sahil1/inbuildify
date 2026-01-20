const express = require("express");
const router = express.Router();

const {
  createFloorPlanPricelistItemMap,
  getAllFloorPlanPricelistItemMaps,
  getFloorPlanPricelistItemMapById,
  updateFloorPlanPricelistItemMap,
  deleteFloorPlanPricelistItemMap,
} = require("../controllers/floor-plan-pricelist-item-map.controller");

const {
  createFloorPlanPricelistItemMapValidation,
  updateFloorPlanPricelistItemMapValidation,
  getFloorPlanPricelistItemMapByIdValidation,
  queryValidation,
} = require("../validations/floor-plan-pricelist-item-map.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

// Create floor plan price list item map
router.post(
  "/",
  validateRequest(
    createFloorPlanPricelistItemMapValidation,
    REQUEST_SOURCE.BODY,
  ),
  createFloorPlanPricelistItemMap,
);

// Get all floor plan price list item maps
router.get(
  "/",
  validateRequest(queryValidation, REQUEST_SOURCE.QUERY),
  getAllFloorPlanPricelistItemMaps,
);

// Get floor plan price list item map by ID
router.get(
  "/:id",
  validateRequest(
    getFloorPlanPricelistItemMapByIdValidation,
    REQUEST_SOURCE.PARAMS,
  ),
  getFloorPlanPricelistItemMapById,
);

// Update floor plan price list item map
router.put(
  "/:id",
  validateRequest(
    getFloorPlanPricelistItemMapByIdValidation,
    REQUEST_SOURCE.PARAMS,
  ),
  validateRequest(
    updateFloorPlanPricelistItemMapValidation,
    REQUEST_SOURCE.BODY,
  ),
  updateFloorPlanPricelistItemMap,
);

// Delete floor plan price list item map
router.delete(
  "/:id",
  validateRequest(
    getFloorPlanPricelistItemMapByIdValidation,
    REQUEST_SOURCE.PARAMS,
  ),
  deleteFloorPlanPricelistItemMap,
);

module.exports = router;
