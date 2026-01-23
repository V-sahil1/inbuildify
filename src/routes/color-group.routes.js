const express = require("express");
const router = express.Router();

const {
  createColorGroup,
  getAllColorGroups,
  getColorGroupById,
  updateColorGroup,
  deleteColorGroup,
} = require("../controllers/color-group.controller");
const {
  createColorGroupSchema,
  getAllColorGroupsSchema,
  getColorGroupByIdSchema,
  updateColorGroupParamsSchema,
  updateColorGroupSchema,
  deleteColorGroupSchema,
} = require("../validations/color-group.validation");

const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");

const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);
router.use(camelToSnakeMiddleware);

// Create a new color group
router.post(
  "/",
  validateRequest(createColorGroupSchema, REQUEST_SOURCE.BODY),
  createColorGroup,
);

// Get all color groups with pagination and filtering
router.get(
  "/",
  validateRequest(getAllColorGroupsSchema, REQUEST_SOURCE.QUERY),
  getAllColorGroups,
);

// Get a specific color group by ID
router.get(
  "/:colorGroupId",
  validateRequest(getColorGroupByIdSchema, REQUEST_SOURCE.PARAMS),
  getColorGroupById,
);

// Update a color group
router.put(
  "/:colorGroupId",
  validateRequest(updateColorGroupParamsSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateColorGroupSchema, REQUEST_SOURCE.BODY),
  updateColorGroup,
);

// Delete a color group
router.delete(
  "/:colorGroupId",
  validateRequest(deleteColorGroupSchema, REQUEST_SOURCE.PARAMS),
  deleteColorGroup,
);

module.exports = router;
