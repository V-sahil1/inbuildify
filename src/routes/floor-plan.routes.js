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
const { createUpload } = require("../middleware/uploadMiddleware");
const {
  createFloorPlanSchema,
  getFloorPlanByIdSchema,
  getFloorPlansSchema,
  updateFloorPlanParamsSchema,
  updateFloorPlanSchema,
  deleteFloorPlanSchema
} = require("../validations/floor-plan.validation");
const { REQUEST_SOURCE } = require("../config/constants");

const upload = createUpload({
  allowedMimeTypes: ["image/"],
  maxFileSize: 10 * 1024 * 1024,
  defaultPath: "floor-plans"
});

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/", validateRequest(createFloorPlanSchema), upload.single("image"), createFloorPlan);

router.get("/", validateRequest(getFloorPlansSchema, REQUEST_SOURCE.QUERY), getFloorPlans);

router.get("/filters", getFloorPlanFilters);

router.get(
  "/:id",
  validateRequest(getFloorPlanByIdSchema, REQUEST_SOURCE.PARAMS),
  getFloorPlanById
);

router.put(
  "/:id",
  validateRequest(updateFloorPlanParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateFloorPlanSchema),
  updateFloorPlan
);

router.delete(
  "/:id",
  validateRequest(deleteFloorPlanSchema, REQUEST_SOURCE.PARAMS),
  deleteFloorPlan
);

module.exports = router;