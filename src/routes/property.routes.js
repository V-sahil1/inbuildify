const express = require("express");
const router = express.Router();
const {
  createProperty,
  getPropertyByLeadId,
} = require("../controllers/property.controller");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const {
  createPropertySchema,
  getPropertyByLeadSchema,
} = require("../validations/property.validation.js");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { REQUEST_SOURCE } = require("../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/", validateRequest(createPropertySchema), createProperty);
router.get("/:lead_id", validateRequest(getPropertyByLeadSchema, REQUEST_SOURCE.PARAMS), getPropertyByLeadId);

module.exports = router;
