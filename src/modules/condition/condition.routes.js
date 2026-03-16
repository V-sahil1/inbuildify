import express from "express";

const router = express.Router();
import { getConditions } from "./condition.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/conditions", getConditions);

export default router;
