import express from "express";

const router = express.Router();
import { createOpportunity, getAllOpportunities } from "./opportunities.controller.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";
import { validateRequest } from "../../middleware/validateRequestMiddleware.js";
import { createOpportunitySchema, getAllOpportunitiesSchema } from "./opportunity.validation.js";
import { REQUEST_SOURCE } from "../../config/constants.js";

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/:lead_id", validateRequest(createOpportunitySchema, REQUEST_SOURCE.PARAMS), createOpportunity);

router.get("/", validateRequest(getAllOpportunitiesSchema, REQUEST_SOURCE.QUERY), getAllOpportunities);

export default router;
