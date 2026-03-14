const express = require("express");
const router = express.Router();

const floorPlanFacadeMapController = require("./floor-plan-facade-map.controller");
const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware");
const { validateRequest } = require("../../middleware/validateRequestMiddleware");
const {
  createFloorPlanFacadeMapSchema,
  getFloorPlanFacadeMapsSchema,
  deleteFloorPlanFacadeMapSchema,
} = require("./floor-plan-facade-map.validation");
const { REQUEST_SOURCE } = require("../../config/constants");

router.post(
  "/",
  camelToSnakeMiddleware,
  authMiddleware,
  roleMiddleware,
  validateRequest(createFloorPlanFacadeMapSchema, REQUEST_SOURCE.BODY),
  floorPlanFacadeMapController.createFloorPlanFacadeMap,
);

router.get(
  "/",
  authMiddleware,
  roleMiddleware,
  validateRequest(getFloorPlanFacadeMapsSchema, REQUEST_SOURCE.QUERY),
  floorPlanFacadeMapController.getFloorPlanFacadeMaps,
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware,
  validateRequest(deleteFloorPlanFacadeMapSchema, REQUEST_SOURCE.PARAMS),
  floorPlanFacadeMapController.deleteFloorPlanFacadeMap,
);

module.exports = router;
