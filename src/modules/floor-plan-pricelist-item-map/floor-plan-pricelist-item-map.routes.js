const express = require("express");
const router = express.Router();

const {
  createFloorPlanPricelistItemMap,
  getAllFloorPlanPricelistItemMaps,
  getFloorPlanPricelistItemMapById,
  updateFloorPlanPricelistItemMap,
  deleteFloorPlanPricelistItemMap,
} = require("./floor-plan-pricelist-item-map.controller.js");

const {
  createFloorPlanPricelistItemMapValidation,
  updateFloorPlanPricelistItemMapValidation,
  getFloorPlanPricelistItemMapByIdValidation,
  queryValidation,
} = require("./floor-plan-pricelist-item-map.validation.js");

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
