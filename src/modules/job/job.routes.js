import express from "express";

const router = express.Router();
import { convertOpportunityToJob } from "./job.controller.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { convertOpportunitySchema } from "./job.validation.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

// Apply basic auth and role middlewares
router.use(authMiddleware);
router.use(roleMiddleware);

// POST /api/job/opportunity/:opportunity_id/convert
router.post(
  "/opportunity/:opportunity_id/convert",
  camelToSnakeMiddleware,
  validateRequest(convertOpportunitySchema.params, REQUEST_SOURCE.PARAMS),
  validateRequest(convertOpportunitySchema.body, REQUEST_SOURCE.BODY),
  convertOpportunityToJob,
);

export default router;
