import express from "express";

const router = express.Router();
import { getDashboardData } from "./dashboard.controller.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", getDashboardData);

export default router;
