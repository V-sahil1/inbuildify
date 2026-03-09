const express = require("express");
const router = express.Router();
const { convertOpportunityToJob } = require("../controllers/job.controller");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const camelToSnakeMiddleware = require("../middleware/caseConverterMiddleware.js");
const { validateRequest } = require("../middleware/validateRequestMiddleware");
const { convertOpportunitySchema } = require("../validations/job.validation");
const { REQUEST_SOURCE } = require("../config/constants");

// Apply basic auth and role middlewares
router.use(authMiddleware);
router.use(roleMiddleware);

// POST /api/job/opportunity/:opportunity_id/convert
router.post(
  "/opportunity/:opportunity_id/convert",
  camelToSnakeMiddleware,
  validateRequest(convertOpportunitySchema.params, REQUEST_SOURCE.PARAMS),
  validateRequest(convertOpportunitySchema.body, REQUEST_SOURCE.BODY),
  convertOpportunityToJob
);

module.exports = router;
