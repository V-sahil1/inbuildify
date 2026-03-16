import express from "express";

const router = express.Router();

import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";

router.use(authMiddleware);
router.use(roleMiddleware);

import { getJobProcessStageFunctionalities } from "./job-process-stage-functionality.controller";

router.get("/", getJobProcessStageFunctionalities);

export default router;
