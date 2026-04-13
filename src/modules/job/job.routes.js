import express from "express";
import { convertOpportunityToJob, getAllJobs, updateJobStatus } from "./job.controller.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import camelToSnakeMiddleware from "../../middleware/caseConverterMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { convertOpportunitySchema } from "./job.validation.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware);

// GET /job — list all jobs with pagination, filtering, sorting
router.get("/", getAllJobs);

// POST /job/opportunity/:opportunity_id/convert — convert opportunity to job
router.post(
  "/opportunity/:opportunity_id/convert",
  camelToSnakeMiddleware,
  validateRequest(convertOpportunitySchema.params, REQUEST_SOURCE.PARAMS),
  validateRequest(convertOpportunitySchema.body, REQUEST_SOURCE.BODY),
  convertOpportunityToJob,
);

// PATCH /job/:job_id/status — update job status
router.patch(
  "/:job_id/status",
  camelToSnakeMiddleware,
  updateJobStatus,
);

export default router;
