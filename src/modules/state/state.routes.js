import express from "express";

const router = express.Router();
import { getState, getAllStates } from "./state.controller";
import authMiddleware from "../../middleware/authMiddleware";
import roleMiddleware from "../../middleware/roleMiddleware";
import { validateRequest } from "../../middleware/validateRequestMiddleware";
import { getStateSchema } from "./state.validation";
import { REQUEST_SOURCE } from "../../config/constants";

router.use(authMiddleware);
router.use(roleMiddleware);

router.get("/", getAllStates);
router.get("/:country_id", validateRequest(getStateSchema, REQUEST_SOURCE.PARAMS), getState);

export default router;
