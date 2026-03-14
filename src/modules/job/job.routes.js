const express = require("express");
const router = express.Router();
const { convertOpportunityToJob } = require("./job.controller.js");
const authMiddleware = require("../../middleware/authMiddleware.js");
const roleMiddleware = require("../../middleware/roleMiddleware.js");
const camelToSnakeMiddleware = require("../../middleware/caseConverterMiddleware.js");
const { validateRequest } = require("../../middleware/validateRequestMiddleware.js");
const { convertOpportunitySchema } = require("./job.validation.js");
const { REQUEST_SOURCE } = require("../../config/constants.js");

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
