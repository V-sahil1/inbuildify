import express from "express";

const router = express.Router();
import { createOpportunity } from "./opportunities.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import { createOpportunitySchema } from "./opportunity.validation";
import { REQUEST_SOURCE } from "../../config/constants";

router.use(authMiddleware);
router.use(roleMiddleware);

router.post("/:lead_id", validateRequest(createOpportunitySchema, REQUEST_SOURCE.PARAMS), createOpportunity);

export default router;
