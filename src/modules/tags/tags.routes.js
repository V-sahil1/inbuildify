import express from "express";

const router = express.Router();
import { getAllTags } from "./tags.controller.js";
import authMiddleware from "../../middleware/authMiddleware.js";
import roleMiddleware from "../../middleware/roleMiddleware.js";

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", getAllTags);

export default router;
