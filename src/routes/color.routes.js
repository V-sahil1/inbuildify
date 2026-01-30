const express = require("express");
const router = express.Router();

const {
  createColor,
  getColors,
  getColorById,
  updateColor,
  deleteColor,
} = require("../controllers/color.controller");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");
const {
  createColorSchema,
  updateColorSchema,
} = require("../validations/color.validation");

router.use(authMiddleware);
router.use(roleMiddleware);

// POST /api/color - Create a new color
router.post(
  "/",
  camelToSnakeMiddleware,
  validateRequest(createColorSchema, REQUEST_SOURCE.BODY),
  createColor,
);

// GET /api/color - Get all colors with optional filtering and pagination
router.get("/", getColors);

// GET /api/color/:id - Get a specific color by ID
router.get("/:id", getColorById);

// PUT /api/color/:id - Update a specific color by ID
router.put(
  "/:id",
  camelToSnakeMiddleware,
  validateRequest(updateColorSchema, REQUEST_SOURCE.BODY),
  updateColor,
);

// DELETE /api/color/:id - Delete a specific color by ID
router.delete("/:id", deleteColor);

module.exports = router;
