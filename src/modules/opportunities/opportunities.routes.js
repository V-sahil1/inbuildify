const express = require("express");
const router = express.Router();
const {
  createOpportunity
} = require("./opportunities.controller");
const authMiddleware = require("../../middleware/authMiddleware");
const roleMiddleware = require("../../middleware/roleMiddleware");
const { validateRequest } = require("../../middleware/validateRequestMiddleware");
const { createOpportunitySchema } = require("./opportunity.validation");
const { REQUEST_SOURCE } = require("../../config/constants");

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/:lead_id", validateRequest(createOpportunitySchema, REQUEST_SOURCE.PARAMS), createOpportunity);

module.exports = router;
