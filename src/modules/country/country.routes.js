import express from "express";

const router = express.Router();
import { getCountries } from "./country.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", getCountries);

export default router;
