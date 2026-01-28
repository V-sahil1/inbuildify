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

router.post(
  "/",
  validateRequest(
    createFloorPlanPricelistItemMapValidation,
    REQUEST_SOURCE.BODY,
  ),
  createFloorPlanPricelistItemMap,
);

router.get(
  "/",
  validateRequest(queryValidation, REQUEST_SOURCE.QUERY),
  getAllFloorPlanPricelistItemMaps,
);

router.get(
  "/:id",
  validateRequest(
    getFloorPlanPricelistItemMapByIdValidation,
    REQUEST_SOURCE.PARAMS,
  ),
  getFloorPlanPricelistItemMapById,
);

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

router.delete(
  "/:id",
  validateRequest(
    getFloorPlanPricelistItemMapByIdValidation,
    REQUEST_SOURCE.PARAMS,
  ),
  deleteFloorPlanPricelistItemMap,
);

module.exports = router;
