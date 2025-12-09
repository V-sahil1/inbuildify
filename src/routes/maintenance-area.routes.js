const express = require("express");
const router = express.Router();

const {
  createMaintenanceArea,
  getAllMaintenanceAreas,
  deleteMaintenanceArea,
  updateMaintenanceArea,
} = require("../controllers/maintenance-area.controller");
const {
  createMaintenanceAreaSchem,
  getAllMaintenanceAreaSchema,
  deleteMaintenanceAreaSchema,
  updateMaintenanceAreaParamsSchema,
  updateMaintenanceAreaSchema,
} = require("../validations/maintenance-area.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post(
  "/",
  validateRequest(createMaintenanceAreaSchem, REQUEST_SOURCE.BODY),
  createMaintenanceArea
);

router.get(
  "/",
  validateRequest(getAllMaintenanceAreaSchema, REQUEST_SOURCE.QUERY),
  getAllMaintenanceAreas
);

router.delete(
  "/:maintenance_area_id",
  validateRequest(deleteMaintenanceAreaSchema, REQUEST_SOURCE.PARAMS),
  deleteMaintenanceArea
);

router.put(
  "/:maintenance_area_id",
  validateRequest(updateMaintenanceAreaParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateMaintenanceAreaSchema, REQUEST_SOURCE.BODY),
  updateMaintenanceArea
);

module.exports = router;
