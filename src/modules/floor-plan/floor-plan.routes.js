const express = require("express");
const router = express.Router();
const {
  createFloorPlan,
  getFloorPlans,
  updateFloorPlan,
  deleteFloorPlan,
  getFloorPlanFilters,
} = require("./floor-plan.controller.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");

const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const { createUpload, handleMulterError } = require("../../utils/s3Upload.js");
const {
  createFloorPlanSchema,
  getFloorPlansSchema,
  updateFloorPlanParamsSchema,
  updateFloorPlanSchema,
  deleteFloorPlanSchema,
} = require("./floor-plan.validation.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");

router.use(authMiddleware);
router.use(roleMiddleware);

const upload = createUpload("floor-plans");

router.post(
  "/",
  upload.fields([
    { name: "detailedImage", maxCount: 1 },
    { name: "simpleImage", maxCount: 1 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(createFloorPlanSchema, REQUEST_SOURCE.FORM_DATA),
  createFloorPlan,
);

router.get(
  "/",
  camelToSnakeMiddleware,
  validateRequest(getFloorPlansSchema, REQUEST_SOURCE.QUERY),
  getFloorPlans,
);

router.get("/filters", getFloorPlanFilters);

router.put(
  "/:floor_plan_id",
  upload.fields([
    { name: "detailedImage", maxCount: 1 },
    { name: "simpleImage", maxCount: 1 },
  ]),
  handleMulterError,
  camelToSnakeMiddleware,
  validateRequest(updateFloorPlanParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateFloorPlanSchema, REQUEST_SOURCE.FORM_DATA),
  updateFloorPlan,
);

router.delete(
  "/:floor_plan_id",
  camelToSnakeMiddleware,
  validateRequest(deleteFloorPlanSchema, REQUEST_SOURCE.PARAMS),
  deleteFloorPlan,
);

module.exports = router;
