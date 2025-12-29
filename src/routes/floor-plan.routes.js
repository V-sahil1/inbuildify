const express = require("express");
const router = express.Router();
const {
  createFloorPlan,
  getFloorPlans,
  updateFloorPlan,
  deleteFloorPlan,
  getFloorPlanFilters,
} = require("../controllers/floor-plan.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { createUpload, handleMulterError } = require("../utils/s3Upload");
const {
  createFloorPlanSchema,
  getFloorPlansSchema,
  updateFloorPlanParamsSchema,
  updateFloorPlanSchema,
  deleteFloorPlanSchema,
} = require("../validations/floor-plan.validation");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("floor-plans");

router.post(
  "/",
  upload.fields([
    { name: "detailed_image", maxCount: 1 },
    { name: "simple_image", maxCount: 1 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createFloorPlanSchema, REQUEST_SOURCE.FORM_DATA),
  createFloorPlan
);

router.get(
  "/",
  camelToSnakeMiddleware,
  validateRequest(getFloorPlansSchema, REQUEST_SOURCE.QUERY),
  getFloorPlans
);

router.get("/filters", getFloorPlanFilters);

router.put(
  "/:floor_plan_id",
  upload.fields([
    { name: "detailed_image", maxCount: 1 },
    { name: "simple_image", maxCount: 1 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateFloorPlanParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateFloorPlanSchema, REQUEST_SOURCE.FORM_DATA),
  updateFloorPlan
);

router.delete(
  "/:floor_plan_id",
  camelToSnakeMiddleware,
  validateRequest(deleteFloorPlanSchema, REQUEST_SOURCE.PARAMS),
  deleteFloorPlan
);

module.exports = router;
