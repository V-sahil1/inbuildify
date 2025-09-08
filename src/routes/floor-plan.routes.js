const express = require("express");
const router = express.Router();
const {
  createFloorPlan,
  getFloorPlans,
  getFloorPlanById,
  updateFloorPlan,
  deleteFloorPlan,
  getFloorPlanFilters
} = require("../controllers/floor-plan.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createUpload, handleMulterError } = require("../utils/s3Upload");
const {
  createFloorPlanSchema,
  getFloorPlanByIdSchema,
  getFloorPlansSchema,
  updateFloorPlanParamsSchema,
  updateFloorPlanSchema,
  deleteFloorPlanSchema
} = require("../validations/floor-plan.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("floor-plans");

router.post("/", upload.single("image"), handleMulterError, validateRequest(createFloorPlanSchema, REQUEST_SOURCE.FORM_DATA), createFloorPlan);

router.get("/", validateRequest(getFloorPlansSchema, REQUEST_SOURCE.QUERY), getFloorPlans);

router.get("/filters", getFloorPlanFilters);

router.get(
  "/:floor_plan_id",
  validateRequest(getFloorPlanByIdSchema, REQUEST_SOURCE.PARAMS),
  getFloorPlanById
);

router.put(
  "/:floor_plan_id",
  upload.single("image"),
  handleMulterError,
  validateRequest(updateFloorPlanParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateFloorPlanSchema, REQUEST_SOURCE.FORM_DATA),
  updateFloorPlan
);

router.delete(
  "/:floor_plan_id",
  validateRequest(deleteFloorPlanSchema, REQUEST_SOURCE.PARAMS),
  deleteFloorPlan
);

module.exports = router;