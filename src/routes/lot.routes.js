const express = require("express");
const router = express.Router();
const {
  createLot,
  getAllLots,
  getLotById,
  updateLot,
  deleteLot,
} = require("../controllers/lot.controller");
const {
  createLotSchema,
  updateLotSchema,
  getLotByIdSchema,
  deleteLotSchema,
  getAllLotsSchema,
} = require("../validations/lot.validation");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const authMiddleware = require("../middleware/authMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware");

// LOT ROUTES

// Create a new lot
router.post(
  "/",
  authMiddleware,
  roleMiddleware,
  camelToSnakeMiddleware,
  validateRequest(createLotSchema, REQUEST_SOURCE.BODY),
  createLot,
);

// Get all lots with filters and pagination
router.get(
  "/",
  authMiddleware,
  roleMiddleware,
  validateRequest(getAllLotsSchema, REQUEST_SOURCE.QUERY),
  getAllLots,
);

// Get a specific lot by ID
router.get(
  "/:lot_id",
  authMiddleware,
  roleMiddleware,
  validateRequest(getLotByIdSchema, REQUEST_SOURCE.PARAMS),
  getLotById,
);

// Update a lot
router.put(
  "/:lot_id",
  authMiddleware,
  roleMiddleware,
  camelToSnakeMiddleware,
  validateRequest(getLotByIdSchema, REQUEST_SOURCE.PARAMS),
  validateRequest(updateLotSchema, REQUEST_SOURCE.BODY),
  updateLot,
);

// Delete a lot
router.delete(
  "/:lot_id",
  authMiddleware,
  roleMiddleware,
  validateRequest(deleteLotSchema, REQUEST_SOURCE.PARAMS),
  deleteLot,
);

module.exports = router;
