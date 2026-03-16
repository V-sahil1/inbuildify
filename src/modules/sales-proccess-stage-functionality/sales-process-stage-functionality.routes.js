import express from "express";

const router = express.Router();

import { getSalesProcessStageFunctionalities } from "./sales-process-stage-functionality.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";

router.use(authMiddleware);
router.use(roleMiddleware);

router.get(
  "/",
  getSalesProcessStageFunctionalities,
);

export default router;
